from fastapi import APIRouter, Depends, HTTPException, Response

from .. import queries
from ..db import Db
from ..deps import current_user
from ..schemas import CartItemIn, MergeIn, QuantityIn

router = APIRouter(prefix="/cart", tags=["cart"])


def cart_id_of(db, user_id: str) -> int:
    row = db.execute("select cart_id from cart where user_id = %s", (user_id,)).fetchone()
    if row:
        return row["cart_id"]
    return db.execute("insert into cart (user_id) values (%s) returning cart_id", (user_id,)).fetchone()["cart_id"]


def cart_lines(db, user_id: str) -> list[dict]:
    items = db.execute(
        """
        select ci.cart_item_id, ci.prod_var_id, ci.quantity
        from cart_item ci join cart c on c.cart_id = ci.cart_id
        where c.user_id = %s
        order by ci.cart_item_id
        """,
        (user_id,),
    ).fetchall()
    variants = {v["prod_var_id"]: v for v in queries.variants_with_product(db, [i["prod_var_id"] for i in items])}
    for i in items:
        i["variant"] = variants[i["prod_var_id"]]
    return items


def add_item(db, user_id: str, prod_var_id: int, quantity: int):
    v = db.execute("select stocks, is_avail from prod_var where prod_var_id = %s", (prod_var_id,)).fetchone()
    if not v or not v["is_avail"] or v["stocks"] <= 0:
        raise HTTPException(400, "This item is out of stock")

    # adds to the same row if the variant is already in the cart, never more than the stock
    db.execute(
        """
        insert into cart_item (cart_id, prod_var_id, quantity)
        values (%(cart)s, %(var)s, least(%(qty)s, %(stocks)s))
        on conflict (cart_id, prod_var_id)
        do update set quantity = least(cart_item.quantity + %(qty)s, %(stocks)s)
        """,
        {"cart": cart_id_of(db, user_id), "var": prod_var_id, "qty": quantity, "stocks": v["stocks"]},
    )


def own_item(db, user_id: str, cart_item_id: int) -> dict:
    row = db.execute(
        """
        select ci.*, v.stocks from cart_item ci
        join cart c on c.cart_id = ci.cart_id
        join prod_var v on v.prod_var_id = ci.prod_var_id
        where ci.cart_item_id = %s and c.user_id = %s
        """,
        (cart_item_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Cart item not found")
    return row


@router.get("")
def get_cart(db: Db, user=Depends(current_user)):
    return cart_lines(db, user["user_id"])


@router.post("/items")
def add_to_cart(db: Db, body: CartItemIn, user=Depends(current_user)):
    add_item(db, user["user_id"], body.prod_var_id, body.quantity)
    return cart_lines(db, user["user_id"])


@router.patch("/items/{cart_item_id}")
def update_quantity(db: Db, cart_item_id: int, body: QuantityIn, user=Depends(current_user)):
    item = own_item(db, user["user_id"], cart_item_id)
    qty = max(1, min(body.quantity, item["stocks"]))
    db.execute("update cart_item set quantity = %s where cart_item_id = %s", (qty, cart_item_id))
    return cart_lines(db, user["user_id"])


@router.delete("/items/{cart_item_id}")
def remove_item(db: Db, cart_item_id: int, user=Depends(current_user)):
    own_item(db, user["user_id"], cart_item_id)
    db.execute("delete from cart_item where cart_item_id = %s", (cart_item_id,))
    return cart_lines(db, user["user_id"])


@router.post("/merge")
def merge_guest_cart(db: Db, body: MergeIn, user=Depends(current_user)):
    for item in body.items:
        try:
            add_item(db, user["user_id"], item.prod_var_id, item.quantity)
        except HTTPException:
            pass  # skip guest items that sold out in the meantime
    return cart_lines(db, user["user_id"])


@router.delete("", status_code=204)
def clear_cart(db: Db, user=Depends(current_user)):
    db.execute(
        "delete from cart_item where cart_id in (select cart_id from cart where user_id = %s)",
        (user["user_id"],),
    )
    return Response(status_code=204)
