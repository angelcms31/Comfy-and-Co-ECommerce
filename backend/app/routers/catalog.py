from typing import Literal

from fastapi import APIRouter, Depends

from .. import queries
from ..db import Db
from ..pricing import effective_price, on_promo, today
from .reviews import reviews_for

router = APIRouter(tags=["catalog"])


@router.get("/categories")
def categories(db: Db):
    return db.execute("select * from item_categ order by item_categ_id").fetchall()


@router.get("/cities")
def cities(db: Db):
    return db.execute(
        """
        select c.*, row_to_json(co) as country
        from city c join country co on co.country_id = c.country_id
        order by c.city
        """
    ).fetchall()


def units_sold(db) -> dict[int, int]:
    rows = db.execute(
        """
        select v.product_id, sum(oi.quantity) as sold
        from order_item oi
        join "order" o on o.order_id = oi.order_id
        join prod_var v on v.prod_var_id = oi.prod_var_id
        where o.order_stat <> 'Cancelled'
        group by v.product_id
        """
    ).fetchall()
    return {r["product_id"]: r["sold"] for r in rows}


@router.get("/products")
def list_products(
    db: Db,
    q: str | None = None,
    item_categ_id: int | None = None,
    collection: Literal["all", "best_sellers", "limited"] = "all",
    min_price: float | None = None,
    max_price: float | None = None,
    sort: Literal["newest", "price_asc", "price_desc", "name"] | None = None,
    include_unavailable: bool = False,
):
    # the catalog is small so filtering is done here instead of in SQL
    products = queries.products_with_variants(db)
    day = today()

    if not include_unavailable:
        for p in products:
            p["variants"] = [v for v in p["variants"] if v["is_avail"]]
        products = [p for p in products if p["is_avail"] and p["variants"]]

    if item_categ_id:
        products = [p for p in products if p["item_categ_id"] == item_categ_id]

    if q and q.strip():
        term = q.strip().lower()

        def matches(p):
            text = [p["product_name"], p["prod_desc"] or "", p["category"]["item_category"]]
            text += [v["sku"] for v in p["variants"]] + [v["prod_attr"] or "" for v in p["variants"]]
            return any(term in t.lower() for t in text)

        products = [p for p in products if matches(p)]

    sold = units_sold(db)
    if collection == "best_sellers":
        products = [p for p in products if sold.get(p["product_id"])]
    elif collection == "limited":
        products = [p for p in products if any(on_promo(v, day) for v in p["variants"])]

    def lowest(p):
        return min((effective_price(v, day) for v in p["variants"]), default=0)

    if min_price is not None:
        products = [p for p in products if lowest(p) >= min_price]
    if max_price is not None:
        products = [p for p in products if lowest(p) <= max_price]

    if sort == "price_asc":
        products.sort(key=lowest)
    elif sort == "price_desc":
        products.sort(key=lowest, reverse=True)
    elif sort == "name":
        products.sort(key=lambda p: p["product_name"].lower())
    elif sort == "newest":
        products.sort(key=lambda p: max((v["date_added"].isoformat() for v in p["variants"]), default=""), reverse=True)
    elif collection == "best_sellers":
        products.sort(key=lambda p: sold.get(p["product_id"], 0), reverse=True)

    return products


@router.get("/products/{product_id}")
def get_product(db: Db, product_id: int):
    return queries.product_or_404(db, product_id)


@router.get("/products/{product_id}/reviews")
def product_reviews(db: Db, product_id: int):
    # reviews are saved per variant, this groups every variant of the product
    return reviews_for(db, "where v.product_id = %s", (product_id,))


@router.get("/variants")
def get_variants(db: Db, ids: str = ""):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    return queries.variants_with_product(db, id_list) if id_list else []
