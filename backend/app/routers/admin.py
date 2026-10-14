import uuid
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from psycopg import errors

from .. import queries
from ..config import IMAGE_BUCKET, LOW_STOCK_LIMIT, TIMEZONE
from ..db import Db
from ..deps import require_admin
from ..pricing import today
from ..schemas import OrderStatusIn, ProductIn
from ..supa import admin_client

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- dashboard ----------

@router.get("/dashboard")
def dashboard(db: Db):
    day = today()
    start = day - timedelta(days=6)

    # sales per day in PH time, cancelled orders don't count
    rows = db.execute(
        """
        select (placed_at at time zone %s)::date as day, sum(total_amt) as total, count(*) as orders
        from "order"
        where order_stat <> 'Cancelled' and (placed_at at time zone %s)::date between %s and %s
        group by 1
        """,
        (TIMEZONE, TIMEZONE, start, day),
    ).fetchall()
    by_day = {r["day"]: r for r in rows}

    last7 = []
    for i in range(7):
        d = start + timedelta(days=i)
        last7.append({"day": d.isoformat(), "total": by_day[d]["total"] if d in by_day else 0})

    counts = db.execute(
        """
        select
          (select count(*) from "order" where (placed_at at time zone %s)::date = %s) as orders_today,
          (select count(*) from "order" where order_stat = 'Pending') as pending,
          (select count(*) from prod_var where stocks <= %s) as low_stock
        """,
        (TIMEZONE, day, LOW_STOCK_LIMIT),
    ).fetchone()

    return {
        "salesToday": by_day[day]["total"] if day in by_day else 0,
        "ordersToday": counts["orders_today"],
        "pendingOrders": counts["pending"],
        "lowStockCount": counts["low_stock"],
        "last7Days": last7,
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
def create_product(db: Db, body: ProductIn):
    try:
        product_id = save_product(db, None, body)
    except errors.UniqueViolation:
        raise HTTPException(400, "That SKU is already used by another product")
    except errors.ForeignKeyViolation:
        raise HTTPException(400, "Please pick a valid category")
    return queries.product_or_404(db, product_id)


@router.put("/products/{product_id}")
def update_product(db: Db, product_id: int, body: ProductIn):
    queries.product_or_404(db, product_id)
    try:
        save_product(db, product_id, body)
    except errors.UniqueViolation:
        raise HTTPException(400, "That SKU is already used by another product")
    except errors.ForeignKeyViolation:
        raise HTTPException(400, "Please pick a valid category")
    return queries.product_or_404(db, product_id)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(db: Db, product_id: int):
    # variants, cart and wishlist rows go with it; old orders keep their item_name / item_price
    deleted = db.execute("delete from product where product_id = %s", (product_id,))
    if deleted.rowcount == 0:
        raise HTTPException(404, "Product not found")
    return Response(status_code=204)


@router.post("/uploads")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Please upload a JPG, PNG or WEBP image")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be 5 MB or smaller")

    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    path = f"{uuid.uuid4().hex}.{ext}"
    bucket = admin_client().storage.from_(IMAGE_BUCKET)
    try:
        bucket.upload(path, data, {"content-type": file.content_type})
    except Exception:
        raise HTTPException(500, "Upload failed, please try again")
    return {"url": bucket.get_public_url(path)}


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
def update_status(db: Db, order_id: int, body: OrderStatusIn):
    order = db.execute('select order_stat from "order" where order_id = %s for update', (order_id,)).fetchone()
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
    return queries.order_or_404(db, order_id)
