import uuid
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from psycopg import errors

from .. import audit, queries
from ..config import IMAGE_BUCKET, LOW_STOCK_LIMIT, TIMEZONE
from ..db import Db
from ..deps import require_admin, require_super_admin
from ..pricing import today
from ..schemas import ArchiveIn, OrderStatusIn, ProductIn, RefundStatusIn
from ..supa import admin_client

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- dashboard ----------

def forecast_next(values: list[float]) -> float:
    # straight line through the actual sales (least squares), continued one step. Never below zero.
    n = len(values)
    if n < 2:
        return values[0] if values else 0
    mean_x, mean_y = (n - 1) / 2, sum(values) / n
    slope_den = sum((i - mean_x) ** 2 for i in range(n))
    slope = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(values)) / slope_den
    return max(0.0, round(mean_y + slope * (n - mean_x), 2))


@router.get("/dashboard")
def dashboard(db: Db, period: Literal["7d", "30d"] = Query("7d", alias="range")):
    day = today()
    days = 7 if period == "7d" else 28
    start = day - timedelta(days=days - 1)

    # sales per day in PH time, cancelled orders don't count
    rows = db.execute(
        """
        select (placed_at at time zone %s)::date as day, sum(total_amt) as total
        from "order"
        where order_stat <> 'Cancelled' and (placed_at at time zone %s)::date between %s and %s
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
    chart.append({"label": next_label, "total": forecast_next(actual), "forecast": True})

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
        "salesToday": by_day.get(day, 0),
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
        )
        if v.prod_var_id:
            updated = db.execute(
                """
                update prod_var set sku = %s, prod_var_name = %s, prod_attr = %s, b_price = %s, pr_price = %s,
                  pr_start = %s, pr_end = %s, stocks = %s, is_avail = %s, images = %s
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
                  pr_start, pr_end, stocks, is_avail, images)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    status: Literal["Pending", "Shipped", "Delivered", "Cancelled"] | None = None,
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


@router.patch("/orders/{order_id}/status")
def update_status(db: Db, request: Request, order_id: int, body: OrderStatusIn, user=Depends(require_admin)):
    order = db.execute('select order_stat, order_num from "order" where order_id = %s for update', (order_id,)).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")
    if order["order_stat"] == "Cancelled" and body.order_stat != "Cancelled":
        raise HTTPException(400, "A cancelled order can't be reopened")

    if body.order_stat == "Cancelled" and order["order_stat"] != "Cancelled":
        # put the stock back
        db.execute(
            """
            update prod_var v set stocks = v.stocks + oi.quantity
            from order_item oi where oi.prod_var_id = v.prod_var_id and oi.order_id = %s
            """,
            (order_id,),
        )

    db.execute('update "order" set order_stat = %s where order_id = %s', (body.order_stat, order_id))
    if body.order_stat != order["order_stat"]:
        audit.log(db, request, user, f"Changed order status: #{order['order_num']} to {body.order_stat}")
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
    return queries.order_or_404(db, order_id)
