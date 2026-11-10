import uuid
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from psycopg import errors

from .. import audit, delivery, events, queries
from ..config import IMAGE_BUCKET, LOW_STOCK_LIMIT, TIMEZONE
from ..db import Db
from ..deps import require_admin, require_super_admin
from ..pricing import today
from ..schemas import ArchiveIn, GcashDecisionIn, OrderStatusIn, ProductIn, RefundStatusIn
from ..supa import admin_client

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- dashboard ----------

def forecast(values: list[float], steps: int = 1) -> list[float]:
    # straight line through the actual sales (least squares), continued `steps` periods. Never below zero.
    n = len(values)
    if n < 2:
        return [round(values[0], 2) if values else 0.0] * steps
    mean_x, mean_y = (n - 1) / 2, sum(values) / n
    slope_den = sum((i - mean_x) ** 2 for i in range(n))
    slope = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(values)) / slope_den
    return [max(0.0, round(mean_y + slope * (n + k - mean_x), 2)) for k in range(steps)]


def add_months(d: date, n: int) -> date:
    # first day of the month n months away from d
    m = d.year * 12 + d.month - 1 + n
    return date(m // 12, m % 12 + 1, 1)


# range -> (past months shown, months forecast)
MONTH_RANGES = {"12m": (12, 6), "24m": (24, 12)}


def daily_chart(db, period: str, day: date) -> tuple[list[dict], float]:
    days = 7 if period == "7d" else 28
    start = day - timedelta(days=days - 1)

    # sales per day in PH time, cancelled orders don't count
    rows = db.execute(
        """
        select (placed_at at time zone %s)::date as day, sum(total_amt) as total
        from "order"
        where order_stat not in ('Cancelled', 'Returned') and (placed_at at time zone %s)::date between %s and %s
        group by 1
        """,
        (TIMEZONE, TIMEZONE, start, day),
    ).fetchall()
    by_day = {r["day"]: float(r["total"]) for r in rows}
    daily = [by_day.get(start + timedelta(days=i), 0.0) for i in range(days)]

    if period == "7d":
        labels = [(start + timedelta(days=i)).strftime("%a") for i in range(days)]
        actual = daily
        next_label = (day + timedelta(days=1)).strftime("%a")
    else:
        # 4 weeks ending today, then the forecast for week 5
        labels = [f"Week {w + 1}" for w in range(4)]
        actual = [sum(daily[w * 7 : w * 7 + 7]) for w in range(4)]
        next_label = "Week 5"

    chart = [{"label": label, "total": total, "forecast": False} for label, total in zip(labels, actual)]
    chart.append({"label": next_label, "total": forecast(actual)[0], "forecast": True})
    return chart, by_day.get(day, 0)


def monthly_chart(db, period: str, day: date) -> list[dict]:
    past, ahead = MONTH_RANGES[period]
    this_month = day.replace(day=1)
    start = add_months(this_month, -(past - 1))

    rows = db.execute(
        """
        select date_trunc('month', placed_at at time zone %s)::date as month, sum(total_amt) as total
        from "order"
        where order_stat not in ('Cancelled', 'Returned') and (placed_at at time zone %s)::date >= %s
        group by 1
        """,
        (TIMEZONE, TIMEZONE, start),
    ).fetchall()
    by_month = {r["month"]: float(r["total"]) for r in rows}
    months = [add_months(start, i) for i in range(past)]
    actual = [by_month.get(m, 0.0) for m in months]

    # fit the trend on finished months only (this month is still running), and skip the
    # empty months before the first sale so they don't drag the line down
    done = actual[:-1]
    first = next((i for i, v in enumerate(done) if v), len(done))
    fit = done[first:]
    # this month gets a forecast too, so the line continues from the last finished month
    projected = forecast(fit, ahead + 1)

    label = lambda m: m.strftime("%b '%y")
    chart = [{"label": label(m), "total": v, "forecast": False} for m, v in zip(months, actual)]
    chart[-1]["partial"] = True
    chart[-1]["expected"] = projected[0]
    chart += [
        {"label": label(add_months(this_month, k + 1)), "total": v, "forecast": True}
        for k, v in enumerate(projected[1:])
    ]
    return chart


@router.get("/dashboard")
def dashboard(db: Db, period: Literal["7d", "30d", "12m", "24m"] = Query("7d", alias="range")):
    day = today()
    if period in MONTH_RANGES:
        chart = monthly_chart(db, period, day)
        _, sales_today = daily_chart(db, "7d", day)
    else:
        chart, sales_today = daily_chart(db, period, day)

    counts = db.execute(
        """
        select
          (select count(*) from "order" where (placed_at at time zone %s)::date = %s) as orders_today,
          (select count(*) from prod_var v join product p using (product_id) where p.is_avail and v.stocks <= %s) as low_stock,
          (select round(avg(rating), 1) from review where not is_hidden) as avg_rating,
          (select count(*) from review where not is_hidden) as review_count
        """,
        (TIMEZONE, day, LOW_STOCK_LIMIT),
    ).fetchone()

    return {
        "salesToday": sales_today,
        "ordersToday": counts["orders_today"],
        "lowStockCount": counts["low_stock"],
        "avgRating": float(counts["avg_rating"] or 0),
        "reviewCount": counts["review_count"],
        "chart": chart,
        "recentOrders": queries.orders_with_items(db)[:6],
    }


# ---------- products ----------

def images_text(images) -> str | None:
    if isinstance(images, list):
        return ",".join(i.strip() for i in images if i.strip()) or None
    return images


def save_product(db, product_id: int | None, body: ProductIn) -> int:
    skus = [v.sku.strip().upper() for v in body.variants]
    if len(set(skus)) != len(skus):
        raise HTTPException(400, "Each variant needs a different SKU")
    for v in body.variants:
        if v.pr_price is not None and (not v.pr_start or not v.pr_end):
            raise HTTPException(400, f"{v.sku}: set the promo start and end dates")
        if v.pr_start and v.pr_end and v.pr_end < v.pr_start:
            raise HTTPException(400, f"{v.sku}: promo end date is before the start date")

    fields = (body.item_categ_id, body.product_name.strip(), body.prod_desc, body.is_avail)
    if product_id is None:
        product_id = db.execute(
            "insert into product (item_categ_id, product_name, prod_desc, is_avail) values (%s, %s, %s, %s) returning product_id",
            fields,
        ).fetchone()["product_id"]
    else:
        db.execute(
            "update product set item_categ_id = %s, product_name = %s, prod_desc = %s, is_avail = %s where product_id = %s",
            (*fields, product_id),
        )

    # variants not in the list anymore are removed, the rest are updated or added
    keep = [v.prod_var_id for v in body.variants if v.prod_var_id]
    db.execute("delete from prod_var where product_id = %s and not (prod_var_id = any(%s))", (product_id, keep))

    for v in body.variants:
        values = (
            v.sku.strip().upper(), v.prod_var_name.strip(), v.prod_attr, v.b_price, v.pr_price,
            v.pr_start, v.pr_end, v.stocks, v.is_avail, images_text(v.images),
            v.length_cm, v.width_cm, v.height_cm, v.weight_kg,
        )
        if v.prod_var_id:
            updated = db.execute(
                """
                update prod_var set sku = %s, prod_var_name = %s, prod_attr = %s, b_price = %s, pr_price = %s,
                  pr_start = %s, pr_end = %s, stocks = %s, is_avail = %s, images = %s,
                  length_cm = %s, width_cm = %s, height_cm = %s, weight_kg = %s
                where prod_var_id = %s and product_id = %s
                """,
                (*values, v.prod_var_id, product_id),
            )
            if updated.rowcount == 0:
                raise HTTPException(400, f"Variant {v.prod_var_id} doesn't belong to this product")
        else:
            db.execute(
                """
                insert into prod_var (product_id, sku, prod_var_name, prod_attr, b_price, pr_price,
                  pr_start, pr_end, stocks, is_avail, images, length_cm, width_cm, height_cm, weight_kg)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (product_id, *values),
            )
    return product_id


@router.post("/products")
def create_product(db: Db, request: Request, body: ProductIn, user=Depends(require_admin)):
    try:
        product_id = save_product(db, None, body)
    except errors.UniqueViolation:
        raise HTTPException(400, "That SKU is already used by another product")
    except errors.ForeignKeyViolation:
        raise HTTPException(400, "Please pick a valid category")
    audit.log(db, request, user, f"Added product: {body.product_name.strip()}")
    return queries.product_or_404(db, product_id)


@router.put("/products/{product_id}")
def update_product(db: Db, request: Request, product_id: int, body: ProductIn, user=Depends(require_admin)):
    before = queries.product_or_404(db, product_id)
    try:
        save_product(db, product_id, body)
    except errors.UniqueViolation:
        raise HTTPException(400, "That SKU is already used by another product")
    except errors.ForeignKeyViolation:
        raise HTTPException(400, "Please pick a valid category")

    # e.g. "Updated product: Slim Shoe Rack (+10 stock)"
    change = sum(v.stocks for v in body.variants) - sum(v["stocks"] for v in before["variants"])
    audit.log(db, request, user, f"Updated product: {body.product_name.strip()}" + (f" ({change:+d} stock)" if change else ""))
    return queries.product_or_404(db, product_id)


@router.patch("/products/{product_id}/archive")
def archive_product(db: Db, request: Request, product_id: int, body: ArchiveIn, user=Depends(require_admin)):
    # archived = is_avail false: hidden from the store, still in old orders, can be restored
    product = queries.product_or_404(db, product_id)
    db.execute("update product set is_avail = %s where product_id = %s", (not body.archived, product_id))
    audit.log(db, request, user, f"{'Archived' if body.archived else 'Restored'} product: {product['product_name']}")
    return queries.product_or_404(db, product_id)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(db: Db, request: Request, product_id: int, user=Depends(require_super_admin)):
    # variants, cart and wishlist rows go with it; old orders keep their item_name / item_price
    product = queries.product_or_404(db, product_id)
    db.execute("delete from product where product_id = %s", (product_id,))
    audit.log(db, request, user, f"Deleted product: {product['product_name']}")
    return Response(status_code=204)


async def store_image(file: UploadFile, folder: str = "") -> str:
    # also used for customer review photos (routers/reviews.py)
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Please upload a JPG, PNG or WEBP image")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be 5 MB or smaller")

    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    path = f"{folder}{uuid.uuid4().hex}.{ext}"
    bucket = admin_client().storage.from_(IMAGE_BUCKET)
    try:
        bucket.upload(path, data, {"content-type": file.content_type})
    except Exception:
        raise HTTPException(500, "Upload failed, please try again")
    return bucket.get_public_url(path)


@router.post("/uploads")
async def upload_image(file: UploadFile = File(...)):
    return {"url": await store_image(file)}


# ---------- orders ----------

@router.get("/orders")
def all_orders(
    db: Db,
    status: Literal["Pending", "Shipped", "Delivered", "Cancelled", "Returned"] | None = None,
    q: str | None = None,
):
    where, params = [], []
    if status:
        where.append("o.order_stat = %s")
        params.append(status)
    if q and q.strip():
        where.append("(o.order_num ilike %s or u.full_name ilike %s)")
        params += [f"%{q.strip()}%"] * 2
    return queries.orders_with_items(db, ("where " + " and ".join(where)) if where else "", tuple(params))


@router.get("/orders/{order_id}")
def one_order(db: Db, order_id: int, user=Depends(require_admin)):
    # with the delivery_token, for the receipt's QR code
    return queries.order_or_404(db, order_id)


def is_delivery(order: dict) -> bool:
    return not order["shipping_add"].startswith("Store pickup")


@router.post("/orders/{order_id}/receipt")
def make_receipt(db: Db, request: Request, order_id: int, user=Depends(require_admin)):
    """Step 1 of shipping: makes the delivery token for the receipt's QR code (the rider scans it at the door).
    The order can only be marked Shipped once this exists, so the QR is always printed before the package leaves."""
    order = db.execute(
        'select order_stat, order_num, payment_method, shipping_add, delivery_token from "order" where order_id = %s for update', (order_id,)
    ).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    if not is_delivery(order):
        raise HTTPException(400, "This is a store pickup order, there is nothing to deliver")
    if order["order_stat"] not in ("Pending", "Shipped"):
        raise HTTPException(400, f"A {order['order_stat'].lower()} order has no delivery receipt")
    if order["payment_method"] == "GCash" and queries.payment_status(order["shipping_add"])[0] != "Paid":
        raise HTTPException(400, "Confirm the GCash payment before making the delivery receipt")
    if not order["delivery_token"]:
        db.execute('update "order" set delivery_token = %s where order_id = %s', (delivery.new_token(), order_id))
        audit.log(db, request, user, f"Made the delivery receipt (QR) for order #{order['order_num']}")
    return queries.order_or_404(db, order_id)


@router.patch("/orders/{order_id}/status")
def update_status(db: Db, request: Request, order_id: int, body: OrderStatusIn, user=Depends(require_admin)):
    order = db.execute(
        'select order_stat, order_num, payment_method, shipping_add, delivery_token from "order" where order_id = %s for update', (order_id,)
    ).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    if body.order_stat == "Shipped" and order["order_stat"] == "Pending" and is_delivery(order) and not order["delivery_token"]:
        raise HTTPException(400, "Generate and print the delivery receipt (QR code) first, then mark the order as shipped")
    if order["order_stat"] in ("Cancelled", "Returned") and body.order_stat != order["order_stat"]:
        raise HTTPException(400, f"A {order['order_stat'].lower()} order can't be reopened")
    if body.order_stat == "Returned" and order["order_stat"] != "Shipped":
        raise HTTPException(400, "Only an order that is out for delivery can be returned to the store")
    if (
        order["order_stat"] == "Pending"
        and body.order_stat in ("Shipped", "Delivered")
        and order["payment_method"] == "GCash"
        and queries.payment_status(order["shipping_add"])[0] != "Paid"
    ):
        raise HTTPException(400, "Confirm the GCash payment before shipping this order")

    if body.order_stat in ("Cancelled", "Returned") and order["order_stat"] != body.order_stat:
        # put the stock back
        db.execute(
            """
            update prod_var v set stocks = v.stocks + oi.quantity
            from order_item oi where oi.prod_var_id = v.prod_var_id and oi.order_id = %s
            """,
            (order_id,),
        )

    db.execute('update "order" set order_stat = %s where order_id = %s', (body.order_stat, order_id))
    if body.order_stat == "Delivered" and order["order_stat"] != "Delivered":
        db.execute("""update "order" set delivered_at = now(), delivered_by = 'admin' where order_id = %s""", (order_id,))
    if body.order_stat != order["order_stat"]:
        audit.log(db, request, user, f"Changed order status: #{order['order_num']} to {body.order_stat}")
        events.notify(db, order_id, "status")
    return queries.order_or_404(db, order_id)


# an admin checks the reference number in the store's GCash app, the site can't see GCash
@router.patch("/orders/{order_id}/payment")
def decide_gcash(db: Db, request: Request, order_id: int, body: GcashDecisionIn, user=Depends(require_admin)):
    order = db.execute('select order_stat, order_num, shipping_add from "order" where order_id = %s for update', (order_id,)).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    status, reference = queries.payment_status(order["shipping_add"])
    if status != "For verification" or order["order_stat"] != "Pending":
        raise HTTPException(400, "This order has no payment waiting to be checked")
    queries.set_gcash_tag(db, order_id, "paid" if body.decision == "confirm" else "rejected", reference)
    verb = "Confirmed" if body.decision == "confirm" else "Rejected"
    audit.log(db, request, user, f"{verb} GCash payment: #{order['order_num']} (ref {reference})")
    events.notify(db, order_id, "payment")
    return queries.order_or_404(db, order_id)


# Requested -> Approved / Rejected, Approved -> Refunded. Refunded and Rejected are final.
REFUND_NEXT = {"Requested": {"Approved", "Rejected"}, "Approved": {"Refunded", "Rejected"}, "Rejected": set(), "Refunded": set()}


@router.patch("/orders/{order_id}/refund")
def update_refund(db: Db, request: Request, order_id: int, body: RefundStatusIn, user=Depends(require_admin)):
    refund = db.execute(
        """
        select r.refund_stat, o.order_num from refund r join "order" o on o.order_id = r.order_id
        where r.order_id = %s for update of r
        """,
        (order_id,),
    ).fetchone()
    if not refund:
        raise HTTPException(404, "This order has no refund request")
    if body.refund_stat != refund["refund_stat"]:
        if body.refund_stat not in REFUND_NEXT[refund["refund_stat"]]:
            old = refund["refund_stat"]
            if not REFUND_NEXT[old]:
                raise HTTPException(400, f"This refund is already {old.lower()}")
            if body.refund_stat == "Refunded":
                raise HTTPException(400, "Approve the refund first")
            raise HTTPException(400, f"A refund can't go from {old} back to {body.refund_stat}")
        db.execute("update refund set refund_stat = %s, updated_at = now() where order_id = %s", (body.refund_stat, order_id))
        audit.log(db, request, user, f"Changed refund status: #{refund['order_num']} to {body.refund_stat}")
        events.notify(db, order_id, "refund")
    return queries.order_or_404(db, order_id)
