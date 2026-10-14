from fastapi import APIRouter, Depends, HTTPException

from .. import queries
from ..db import Db
from ..deps import current_user
from ..pricing import effective_price
from ..schemas import PlaceOrderIn
from .users import update_profile

router = APIRouter(prefix="/orders", tags=["orders"])


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

    # one address per user, so the info confirmed at checkout is saved to their profile
    customer = body.customer.model_dump()
    update_profile(db, user["user_id"], customer)

    subtotal = total = 0
    items = []
    for prod_var_id, qty in wanted.items():
        v = by_id[prod_var_id]
        price = effective_price(v)
        subtotal += v["b_price"] * qty
        total += price * qty
        items.append((prod_var_id, v["prod_var_name"], price, qty, price * qty))

    # note: the checkout note has no column yet (SCHEMA_GAPS #2), so body.note isn't saved
    order = db.execute(
        """
        insert into "order" (order_num, user_id, order_stat, subtotal, disc_amt, total_amt, payment_method, shipping_add)
        values (%s, %s, 'Pending', %s, %s, %s, %s, %s)
        returning order_id
        """,
        (
            next_order_num(db),
            user["user_id"],
            subtotal,
            subtotal - total,
            total,
            body.payment_method,
            queries.address_text(db, customer["st_add"], customer["city_id"], customer["postal"]),
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
    return queries.order_or_404(db, order["order_id"])


@router.get("/me")
def my_orders(db: Db, user=Depends(current_user)):
    return queries.orders_with_items(db, "where o.user_id = %s", (user["user_id"],))


def own_order(db, user: dict, order_id: int) -> dict:
    order = queries.order_or_404(db, order_id)
    if order["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(404, "Order not found")
    return order


@router.get("/{order_id}")
def get_order(db: Db, order_id: int, user=Depends(current_user)):
    return own_order(db, user, order_id)


@router.post("/{order_id}/gcash/confirm")
def confirm_gcash(db: Db, order_id: int, user=Depends(current_user)):
    # GCash is only a mock screen. Marking it as paid needs a payment status column (SCHEMA_GAPS #2).
    order = own_order(db, user, order_id)
    if order["payment_method"] != "GCash":
        raise HTTPException(400, "This order is not paid with GCash")
    return order
