from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .. import delivery, events, queries
from ..config import COURIER, IMAGE_BUCKET
from ..db import Db
from ..deps import ADMIN_ROLES, current_user
from ..pricing import effective_price
from ..schemas import CancelOrderIn, DeliveryFeedbackIn, DeliveryQuoteIn, GcashPaymentIn, PlaceOrderIn, RefundIn
from ..supa import admin_client
from .admin import images_text, store_image
from .users import update_profile

router = APIRouter(prefix="/orders", tags=["orders"])

REFUND_PHOTO_FOLDER = "refunds/"


def customer_view(order: dict) -> dict:
    # the QR token is only for the printed receipt, the customer has the "Order received" button instead
    order.pop("delivery_token", None)
    return order


def delivery_quote(db, settings: dict, wanted: dict[int, int], st_add: str, city_id: int, postal: str | None, lat: float | None, lng: float | None) -> dict:
    rows = db.execute(
        "select prod_var_id, prod_var_name, length_cm, width_cm, height_cm, weight_kg from prod_var where prod_var_id = any(%s)",
        (list(wanted),),
    ).fetchall()
    items = [{**r, "quantity": wanted[r["prod_var_id"]]} for r in rows]
    return delivery.quote(settings, items, lat, lng, queries.address_text(db, st_add, city_id, postal))


@router.post("/delivery-quote")
def quote_delivery(db: Db, body: DeliveryQuoteIn, user=Depends(current_user)):
    # the checkout shows the vehicle, distance and fee for the address (or pin) before the order is placed
    wanted: dict[int, int] = {}
    for line in body.lines:
        wanted[line.prod_var_id] = wanted.get(line.prod_var_id, 0) + line.quantity
    return delivery_quote(db, queries.setting(db, "delivery"), wanted, body.st_add, body.city_id, body.postal, body.lat, body.lng)


def next_order_num(db) -> str:
    row = db.execute(
        """select coalesce(max(substring(order_num from 5)::int), 1000) as last from "order" where order_num like 'ORD-%%'"""
    ).fetchone()
    return f"ORD-{row['last'] + 1}"


@router.post("")
def place_order(db: Db, body: PlaceOrderIn, user=Depends(current_user)):
    # merge duplicate lines, then lock the variants so two people can't buy the last item at the same time
    wanted: dict[int, int] = {}
    for line in body.lines:
        wanted[line.prod_var_id] = wanted.get(line.prod_var_id, 0) + line.quantity

    variants = db.execute(
        """
        select v.* from prod_var v join product p on p.product_id = v.product_id
        where v.prod_var_id = any(%s) and v.is_avail and p.is_avail
        for update of v
        """,
        (list(wanted),),
    ).fetchall()
    by_id = {v["prod_var_id"]: v for v in variants}

    for prod_var_id, qty in wanted.items():
        v = by_id.get(prod_var_id)
        if not v:
            raise HTTPException(400, "An item in your cart is no longer available")
        if qty > v["stocks"]:
            raise HTTPException(400, f"Only {v['stocks']} left of {v['prod_var_name']}")

    # one address per user, so the info confirmed at checkout (and the map pin) is saved to their profile
    customer = body.customer.model_dump()
    drop = body.drop_off
    update_profile(db, user["user_id"], {**customer, "lat": drop.lat, "lng": drop.lng, "delivery_note": (drop.delivery_note or "").strip() or None})

    subtotal = total = 0
    items = []
    for prod_var_id, qty in wanted.items():
        v = by_id[prod_var_id]
        price = effective_price(v)
        subtotal += v["b_price"] * qty
        total += price * qty
        items.append((prod_var_id, v["prod_var_name"], price, qty, price * qty))

    # the delivery fee goes on top of the items; disc_amt stays the promo savings only (SCHEMA_GAPS #8)
    address = queries.address_text(db, customer["st_add"], customer["city_id"], customer["postal"])
    if body.fulfillment == "delivery":
        q = delivery_quote(db, queries.setting(db, "delivery"), wanted, customer["st_add"], customer["city_id"], customer["postal"], drop.lat, drop.lng)
        shipping_add = f"{address} (Standard Delivery via {COURIER})"
    else:
        q = {"courier": None, "vehicle": None, "trips": 1, "distance_km": None, "delivery_fee": 0, "drop_lat": None, "drop_lng": None}
        shipping_add = f"Store pickup. Customer address: {address}"
    fee = q["delivery_fee"]

    # note: the checkout note has no column yet (SCHEMA_GAPS #2), so body.note isn't saved
    order = db.execute(
        """
        insert into "order" (order_num, user_id, order_stat, subtotal, disc_amt, total_amt, payment_method, shipping_add,
          courier, vehicle, trips, distance_km, delivery_fee, drop_lat, drop_lng, delivery_note)
        values (%s, %s, 'Pending', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        returning order_id
        """,
        (
            next_order_num(db),
            user["user_id"],
            subtotal,
            subtotal - total,
            total + fee,
            body.payment_method,
            shipping_add,
            q["courier"],
            q["vehicle"],
            q["trips"],
            q["distance_km"],
            fee,
            q["drop_lat"],
            q["drop_lng"],
            (drop.delivery_note or "").strip() or None if body.fulfillment == "delivery" else None,
        ),
    ).fetchone()

    with db.cursor() as cur:
        cur.executemany(
            """
            insert into order_item (order_id, prod_var_id, item_name, item_price, quantity, sub_total)
            values (%s, %s, %s, %s, %s, %s)
            """,
            [(order["order_id"], *item) for item in items],
        )
        cur.executemany(
            "update prod_var set stocks = stocks - %s where prod_var_id = %s",
            [(qty, prod_var_id) for prod_var_id, qty in wanted.items()],
        )

    db.execute(
        """
        delete from cart_item
        where cart_id in (select cart_id from cart where user_id = %s) and prod_var_id = any(%s)
        """,
        (user["user_id"], list(wanted)),
    )
    events.notify(db, order["order_id"], "placed")
    return customer_view(queries.order_or_404(db, order["order_id"]))


@router.get("/me")
def my_orders(db: Db, user=Depends(current_user)):
    return [customer_view(o) for o in queries.orders_with_items(db, "where o.user_id = %s", (user["user_id"],))]


def own_order(db, user: dict, order_id: int) -> dict:
    order = queries.order_or_404(db, order_id)
    if order["user_id"] != user["user_id"] and user["role"] not in ADMIN_ROLES:
        raise HTTPException(404, "Order not found")
    return order


@router.get("/{order_id}")
def get_order(db: Db, order_id: int, user=Depends(current_user)):
    return customer_view(own_order(db, user, order_id))


@router.post("/{order_id}/cancel")
def cancel_order(db: Db, order_id: int, body: CancelOrderIn, user=Depends(current_user)):
    order = own_order(db, user, order_id)
    if order["order_stat"] != "Pending":
        raise HTTPException(400, "Only orders that haven't shipped yet can be cancelled")
    if order["_temp_payment_status"] in ("Paid", "For verification"):
        raise HTTPException(400, "This order has a GCash payment, please contact us to cancel it")
    db.execute(
        """
        update prod_var v set stocks = v.stocks + oi.quantity
        from order_item oi where oi.prod_var_id = v.prod_var_id and oi.order_id = %s
        """,
        (order_id,),
    )
    # no column for the reason (SCHEMA_GAPS #20), so it's added to the end of shipping_add
    db.execute(
        """update "order" set order_stat = 'Cancelled', shipping_add = shipping_add || %s where order_id = %s""",
        (f" [Cancelled by buyer: {body.reason.strip()}]", order_id),
    )
    events.notify(db, order_id, "cancelled")
    return customer_view(queries.order_or_404(db, order_id))


@router.post("/{order_id}/received")
def mark_received(db: Db, order_id: int, user=Depends(current_user)):
    order = own_order(db, user, order_id)
    if order["order_stat"] != "Shipped":
        raise HTTPException(400, "Only orders that are on the way can be marked as received")
    db.execute(
        """update "order" set order_stat = 'Delivered', delivered_at = now(), delivered_by = 'customer' where order_id = %s""",
        (order_id,),
    )
    events.notify(db, order_id, "received")
    return customer_view(queries.order_or_404(db, order_id))


@router.post("/{order_id}/delivery-feedback")
def delivery_feedback(db: Db, order_id: int, body: DeliveryFeedbackIn, user=Depends(current_user)):
    # "Did you get your order?" after the rider marked it delivered: yes closes the question, no is a report the admin sees on the order
    order = own_order(db, user, order_id)
    if order["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order not found")
    if order["order_stat"] != "Delivered":
        raise HTTPException(400, "This order has not been marked as delivered yet")
    if order["receipt_confirmed_at"] or order["not_received_at"]:
        raise HTTPException(400, "You already answered for this order")
    if body.received:
        db.execute('update "order" set receipt_confirmed_at = now() where order_id = %s', (order_id,))
    else:
        details = (body.details or "").strip()
        if not details:
            raise HTTPException(400, "Please tell us what happened")
        db.execute('update "order" set not_received_report = %s, not_received_at = now() where order_id = %s', (details, order_id))
    events.notify(db, order_id, "feedback", received=body.received)
    return customer_view(queries.order_or_404(db, order_id))


@router.post("/uploads")
async def upload_refund_photo(file: UploadFile = File(...), user=Depends(current_user)):
    return {"url": await store_image(file, REFUND_PHOTO_FOLDER)}


@router.post("/{order_id}/refund")
def request_refund(db: Db, order_id: int, body: RefundIn, user=Depends(current_user)):
    order = own_order(db, user, order_id)
    if order["order_stat"] != "Delivered":
        raise HTTPException(400, "You can only ask for a refund after the order is delivered")
    if order["refund"]:
        raise HTTPException(400, "A refund was already requested for this order")
    details = (body.details or "").strip() or None
    # "Other" can be something a photo can't show, every other reason is about the item itself
    if not body.photos and body.reason.strip() != "Other":
        raise HTTPException(400, "Please add at least one photo of the item")
    folder = admin_client().storage.from_(IMAGE_BUCKET).get_public_url(REFUND_PHOTO_FOLDER).rstrip("?")
    if not all(p.startswith(folder) and "," not in p for p in body.photos):
        raise HTTPException(400, "Please upload the photos again")
    db.execute(
        "insert into refund (order_id, reason, details, amount, photos) values (%s, %s, %s, %s, %s)",
        (order_id, body.reason.strip(), details, order["total_amt"], images_text(body.photos)),
    )
    events.notify(db, order_id, "refund")
    return customer_view(queries.order_or_404(db, order_id))


@router.post("/{order_id}/gcash/confirm")
def confirm_gcash(db: Db, order_id: int, body: GcashPaymentIn, user=Depends(current_user)):
    # the customer paid by scanning the store's QR and sends the reference number, an admin then checks it in the GCash app
    order = own_order(db, user, order_id)
    if order["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order not found")
    if order["payment_method"] != "GCash":
        raise HTTPException(400, "This order is not paid with GCash")
    if order["_temp_payment_status"] in ("Paid", "For verification"):
        if order["_temp_payment_ref"] == body.reference:
            return customer_view(order)
        raise HTTPException(400, "We already have a reference number for this order")
    if order["order_stat"] != "Pending":
        raise HTTPException(400, "This order can't be paid anymore")
    used = db.execute(
        """select 1 from "order" where order_id <> %s and (shipping_add like %s or shipping_add like %s)""",
        (order_id, f"%[GCash submitted, ref {body.reference}]%", f"%[GCash paid, ref {body.reference}]%"),
    ).fetchone()
    if used:
        raise HTTPException(400, "This reference number was already used for another order")
    queries.set_gcash_tag(db, order_id, "submitted", body.reference)
    events.notify(db, order_id, "payment")
    return customer_view(queries.order_or_404(db, order_id))
