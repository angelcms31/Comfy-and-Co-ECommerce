"""Loads rows and joins them into the shapes the frontend expects (see frontend/src/types/models.ts)."""

import re
import json
from functools import cache
from pathlib import Path

from fastapi import HTTPException

from .config import SETTING_DEFAULTS


def setting(db, key: str) -> dict:
    # saved values on top of the defaults, so new fields added later still have a value
    row = db.execute("select value from store_setting where key = %s", (key,)).fetchone()
    return {**SETTING_DEFAULTS.get(key, {}), **(row["value"] if row else {})}


@cache
def subcategories() -> dict[str, str]:
    # item_categ has no subcategory (SCHEMA_GAPS #16), so it's read from the inventory sheet data by product name
    path = Path(__file__).resolve().parent.parent / "supabase" / "products.json"
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {r["name"].strip().lower(): r["subcategory"] for r in rows if r.get("subcategory")}


def profile(db, user_id: str) -> dict | None:
    u = db.execute(
        """
        select u.*, r.user_role as role
        from "user" u join user_role r on r.user_role_id = u.user_role_id
        where u.user_id = %s
        """,
        (user_id,),
    ).fetchone()
    if not u:
        return None

    u["city"] = None
    if u["city_id"]:
        city = db.execute("select * from city where city_id = %s", (u["city_id"],)).fetchone()
        city["country"] = db.execute("select * from country where country_id = %s", (city["country_id"],)).fetchone()
        u["city"] = city
    return u


def products_with_variants(db, product_ids: list[int] | None = None) -> list[dict]:
    where = "where p.product_id = any(%s)" if product_ids is not None else ""
    params = (product_ids,) if product_ids is not None else ()

    products = db.execute(
        f"""
        select p.*, row_to_json(c) as category
        from product p join item_categ c on c.item_categ_id = p.item_categ_id
        {where}
        order by p.product_id
        """,
        params,
    ).fetchall()

    ids = [p["product_id"] for p in products]
    variants = db.execute("select * from prod_var where product_id = any(%s) order by prod_var_id", (ids,)).fetchall()
    subs = subcategories()
    for p in products:
        p["variants"] = [v for v in variants if v["product_id"] == p["product_id"]]
        p["_temp_subcategory"] = subs.get(p["product_name"].strip().lower())
    return products


def product_or_404(db, product_id: int) -> dict:
    found = products_with_variants(db, [product_id])
    if not found:
        raise HTTPException(404, "Product not found")
    return found[0]


def variants_with_product(db, prod_var_ids: list[int]) -> list[dict]:
    rows = db.execute(
        """
        select v.*, row_to_json(p) as product
        from prod_var v join product p on p.product_id = v.product_id
        where v.prod_var_id = any(%s)
        """,
        (prod_var_ids,),
    ).fetchall()
    return rows


# added to the end of shipping_add as an e-wallet payment moves along (SCHEMA_GAPS #2), e.g. " [Maya submitted, ref 1A2B3C]".
# payment_method stays "GCash" for every e-wallet (no schema change), the tag names the wallet the customer used.
# A cancel reason can come after it.
GCASH_TAG = re.compile(r" \[(GCash|Maya|MariBank) (submitted|paid|rejected), ref ([A-Za-z0-9]+)\](?: \[Cancelled by buyer: .+\])?$")
GCASH_STATUS = {"submitted": "For verification", "paid": "Paid", "rejected": "Rejected"}


def payment_status(shipping_add: str) -> tuple[str, str | None]:
    tag = GCASH_TAG.search(shipping_add)
    return (GCASH_STATUS[tag.group(2)], tag.group(3)) if tag else ("Unpaid", None)


def payment_wallet(shipping_add: str) -> str | None:
    # the e-wallet the reference number came from, None before one was sent
    tag = GCASH_TAG.search(shipping_add)
    return tag.group(1) if tag else None


def set_gcash_tag(db, order_id: int, state: str, reference: str, wallet: str = "GCash") -> None:
    db.execute(
        """
        update "order" set shipping_add = regexp_replace(shipping_add, ' \\[(GCash|Maya|MariBank) (submitted|rejected), ref [A-Za-z0-9]+\\]$', '') || %s
        where order_id = %s
        """,
        (f" [{wallet} {state}, ref {reference}]", order_id),
    )


def orders_with_items(db, where: str = "", params: tuple = ()) -> list[dict]:
    orders = db.execute(
        f"""
        select o.*, u.full_name as customer_name, u.mobile_no as customer_mobile,
          case when r.refund_id is null then null else row_to_json(r) end as refund
        from "order" o join "user" u on u.user_id = o.user_id
        left join refund r on r.order_id = o.order_id
        {where}
        order by o.placed_at desc
        """,
        params,
    ).fetchall()

    ids = [o["order_id"] for o in orders]
    # product_id, color and images come from the variant for the order list (null if the product was deleted)
    items = db.execute(
        """
        select oi.*, v.product_id, v.prod_attr as color, v.images
        from order_item oi left join prod_var v on v.prod_var_id = oi.prod_var_id
        where oi.order_id = any(%s) order by oi.order_item_id
        """,
        (ids,),
    ).fetchall()
    attempts = db.execute(
        "select * from delivery_attempt where order_id = any(%s) order by attempted_at", (ids,)
    ).fetchall()
    for o in orders:
        o["items"] = [i for i in items if i["order_id"] == o["order_id"]]
        o["attempts"] = [a for a in attempts if a["order_id"] == o["order_id"]]  # the rider's failed hand-overs
        o["_temp_payment_status"], o["_temp_payment_ref"] = payment_status(o["shipping_add"])
        o["_temp_payment_wallet"] = payment_wallet(o["shipping_add"])
    return orders


def order_or_404(db, order_id: int) -> dict:
    found = orders_with_items(db, "where o.order_id = %s", (order_id,))
    if not found:
        raise HTTPException(404, "Order not found")
    return found[0]


def address_text(db, st_add: str | None, city_id: int | None, postal: str | None) -> str:
    city = country = None
    if city_id:
        row = db.execute(
            "select c.city, co.country from city c join country co on co.country_id = c.country_id where c.city_id = %s",
            (city_id,),
        ).fetchone()
        if row:
            city, country = row["city"], row["country"]
    return ", ".join(part for part in [st_add, city, postal, country] if part)
