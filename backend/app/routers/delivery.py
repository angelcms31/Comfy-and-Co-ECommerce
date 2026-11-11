"""The Lalamove rider's page, opened by scanning the QR code on the printed receipt (frontend /deliver/<order>/<token>).

No login: the token in the QR code is the key. It only works while the order is Shipped, so the link on a delivered
package can't be used again. The rider sees where to go and who to call, then takes 1-3 photos to mark the order delivered.
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import events, queries
from ..config import FAILED_ATTEMPT_REASONS, MAX_DELIVERY_ATTEMPTS
from ..db import Db
from .admin import images_text, store_image

router = APIRouter(prefix="/delivery", tags=["delivery"])

PROOF_PHOTO_FOLDER = "deliveries/"
MAX_PROOF_PHOTOS = 3


def rider_order(db, order_num: str, token: str) -> dict:
    order = db.execute(
        """
        select o.order_id, o.order_num, o.order_stat, o.payment_method, o.total_amt, o.shipping_add, o.vehicle, o.trips,
          o.drop_lat, o.drop_lng, o.delivery_note, o.delivered_at, o.delivered_by, o.proof_photos,
          u.full_name as customer_name, u.mobile_no
        from "order" o join "user" u on u.user_id = o.user_id
        where o.order_num = %s and o.delivery_token = %s
        """,
        (order_num, token),
    ).fetchone()
    if not order:
        raise HTTPException(404, "This delivery link is not valid")
    order["items"] = db.execute(
        "select item_name, quantity from order_item where order_id = %s order by order_item_id", (order["order_id"],)
    ).fetchall()
    order["attempts"] = db.execute(
        "select reason, note, attempted_at from delivery_attempt where order_id = %s order by attempted_at", (order["order_id"],)
    ).fetchall()
    order["max_attempts"] = MAX_DELIVERY_ATTEMPTS
    order["reasons"] = FAILED_ATTEMPT_REASONS
    # what the rider collects at the door: the whole amount for COD, nothing when it was paid by e-wallet
    paid = queries.payment_status(order["shipping_add"])[0] == "Paid"
    order["collect_amt"] = 0 if order["payment_method"] != "COD" and paid else order["total_amt"]
    # the plain address, without the "(Standard Delivery via ...)" and payment tags the backend adds to shipping_add
    order["address"] = order["shipping_add"].split(" (Standard Delivery via ")[0]
    del order["shipping_add"]
    return order


@router.get("/{order_num}/{token}")
def get_delivery(db: Db, order_num: str, token: str):
    return rider_order(db, order_num, token)


@router.post("/{order_num}/{token}/confirm")
async def confirm_delivery(db: Db, order_num: str, token: str, photos: list[UploadFile] = File(...)):
    order = rider_order(db, order_num, token)
    if order["order_stat"] == "Delivered":
        return order
    if order["order_stat"] != "Shipped":
        raise HTTPException(400, "This order is not out for delivery")
    if not 1 <= len(photos) <= MAX_PROOF_PHOTOS:
        raise HTTPException(400, f"Please take 1 to {MAX_PROOF_PHOTOS} photos of the delivered package")

    urls = [await store_image(p, PROOF_PHOTO_FOLDER) for p in photos]
    db.execute(
        """
        update "order" set order_stat = 'Delivered', delivered_at = now(), delivered_by = 'rider', proof_photos = %s
        where order_id = %s and order_stat = 'Shipped'
        """,
        (images_text(urls), order["order_id"]),
    )
    events.notify(db, order["order_id"], "delivered")
    return rider_order(db, order_num, token)


@router.post("/{order_num}/{token}/failed")
def failed_attempt(db: Db, order_num: str, token: str, reason: str = Form(...), note: str | None = Form(default=None)):
    """The rider couldn't hand the package over. After MAX_DELIVERY_ATTEMPTS the order is Returned and the stock goes back."""
    order = rider_order(db, order_num, token)
    if order["order_stat"] != "Shipped":
        raise HTTPException(400, "This order is not out for delivery")
    if reason not in FAILED_ATTEMPT_REASONS:
        raise HTTPException(400, "Please pick a reason")
    note = (note or "").strip()[:300] or None
    if reason == "Other" and not note:
        raise HTTPException(400, "Please say what happened")

    db.execute("insert into delivery_attempt (order_id, reason, note) values (%s, %s, %s)", (order["order_id"], reason, note))
    if len(order["attempts"]) + 1 >= MAX_DELIVERY_ATTEMPTS:
        db.execute(
            """
            update prod_var v set stocks = v.stocks + oi.quantity
            from order_item oi where oi.prod_var_id = v.prod_var_id and oi.order_id = %s
            """,
            (order["order_id"],),
        )
        db.execute("""update "order" set order_stat = 'Returned' where order_id = %s and order_stat = 'Shipped'""", (order["order_id"],))
        events.notify(db, order["order_id"], "returned", reason=reason)
    else:
        events.notify(db, order["order_id"], "failed_attempt", reason=reason, attempts=len(order["attempts"]) + 1)
    return rider_order(db, order_num, token)
