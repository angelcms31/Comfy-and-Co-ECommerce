"""Loads rows and joins them into the shapes the frontend expects (see frontend/src/types/models.ts)."""

from fastapi import HTTPException


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
    for p in products:
        p["variants"] = [v for v in variants if v["product_id"] == p["product_id"]]
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


def orders_with_items(db, where: str = "", params: tuple = ()) -> list[dict]:
    orders = db.execute(
        f"""
        select o.*, u.full_name as customer_name
        from "order" o join "user" u on u.user_id = o.user_id
        {where}
        order by o.placed_at desc
        """,
        params,
    ).fetchall()

    ids = [o["order_id"] for o in orders]
    items = db.execute("select * from order_item where order_id = any(%s) order by order_item_id", (ids,)).fetchall()
    for o in orders:
        o["items"] = [i for i in items if i["order_id"] == o["order_id"]]
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
