from fastapi import APIRouter, Depends, HTTPException

from .. import queries
from ..db import Db
from ..deps import current_user
from ..schemas import WishlistIn

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


def collection_id_of(db, user_id: str) -> int:
    # one default collection per user, made the first time they like something
    row = db.execute("select wishlist_coll_id from wishlist_col where user_id = %s order by wishlist_coll_id limit 1", (user_id,)).fetchone()
    if row:
        return row["wishlist_coll_id"]
    return db.execute(
        "insert into wishlist_col (user_id) values (%s) returning wishlist_coll_id", (user_id,)
    ).fetchone()["wishlist_coll_id"]


def wishlist_lines(db, user_id: str) -> list[dict]:
    items = db.execute(
        """
        select wi.* from wishlist_item wi
        join wishlist_col wc on wc.wishlist_coll_id = wi.wishlist_coll_id
        where wc.user_id = %s
        order by wi.created_at desc
        """,
        (user_id,),
    ).fetchall()
    variants = {v["prod_var_id"]: v for v in queries.variants_with_product(db, [i["prod_var_id"] for i in items])}
    for i in items:
        i["variant"] = variants[i["prod_var_id"]]
    return items


@router.get("")
def get_wishlist(db: Db, user=Depends(current_user)):
    return wishlist_lines(db, user["user_id"])


@router.post("/items")
def add_to_wishlist(db: Db, body: WishlistIn, user=Depends(current_user)):
    if not db.execute("select 1 from prod_var where prod_var_id = %s", (body.prod_var_id,)).fetchone():
        raise HTTPException(404, "Product not found")
    db.execute(
        """
        insert into wishlist_item (wishlist_coll_id, prod_var_id) values (%s, %s)
        on conflict (wishlist_coll_id, prod_var_id) do nothing
        """,
        (collection_id_of(db, user["user_id"]), body.prod_var_id),
    )
    return wishlist_lines(db, user["user_id"])


@router.delete("/items/{wishlist_item_id}")
def remove_from_wishlist(db: Db, wishlist_item_id: int, user=Depends(current_user)):
    db.execute(
        """
        delete from wishlist_item wi using wishlist_col wc
        where wc.wishlist_coll_id = wi.wishlist_coll_id and wi.wishlist_item_id = %s and wc.user_id = %s
        """,
        (wishlist_item_id, user["user_id"]),
    )
    return wishlist_lines(db, user["user_id"])
