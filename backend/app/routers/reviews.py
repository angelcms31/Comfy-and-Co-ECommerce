from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from .. import audit
from ..db import Db
from ..deps import current_user, require_admin
from ..schemas import ReviewFlagsIn, ReviewIn, ReviewReplyIn
from .admin import images_text, store_image

router = APIRouter(prefix="/admin/reviews", tags=["reviews"], dependencies=[Depends(require_admin)])
customer_router = APIRouter(prefix="/reviews", tags=["reviews"])

REVIEW_SELECT = """
    select r.*, u.full_name as reviewer_name, p.product_id, p.product_name, v.prod_attr, v.images as product_images,
      c.item_categ_id, c.item_category
    from review r
    join "user" u on u.user_id = r.user_id
    join prod_var v on v.prod_var_id = r.prod_var_id
    join product p on p.product_id = v.product_id
    join item_categ c on c.item_categ_id = p.item_categ_id
"""


def summarize(rows: list[dict]) -> dict:
    breakdown = {str(n): 0 for n in range(1, 6)}
    for r in rows:
        breakdown[str(r["rating"])] += 1
    average = round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else 0
    return {"average": average, "count": len(rows), "breakdown": breakdown}


def reviews_for(db, where: str = "", params: tuple = ()) -> dict:
    # store side: hidden reviews are left out, featured ones go first
    clause = f"{where} and not r.is_hidden" if where else "where not r.is_hidden"
    rows = db.execute(f"{REVIEW_SELECT} {clause} order by r.is_featured desc, r.created_at desc", params).fetchall()
    for r in rows:
        # anonymous reviews: the store page never gets the name or the account behind it
        if r.get("is_anonymous"):
            r["reviewer_name"] = "Anonymous"
            r["user_id"] = None
    return {"summary": summarize(rows), "reviews": rows}


def review_or_404(db, review_id: int) -> dict:
    row = db.execute(f"{REVIEW_SELECT} where r.review_id = %s", (review_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Review not found")
    return row


# ---------- admin ----------

@router.get("")
def all_reviews(db: Db):
    # every review including hidden ones; search and filters are done on the page
    rows = db.execute(f"{REVIEW_SELECT} order by r.created_at desc").fetchall()
    return {
        "summary": summarize([r for r in rows if not r["is_hidden"]]),
        "pendingReplies": sum(1 for r in rows if not r["reply"] and not r["is_hidden"]),
        "hiddenCount": sum(1 for r in rows if r["is_hidden"]),
        "reviews": rows,
    }


@router.patch("/{review_id}")
def set_flags(db: Db, request: Request, review_id: int, body: ReviewFlagsIn, user=Depends(require_admin)):
    review = review_or_404(db, review_id)
    if body.is_hidden is not None:
        db.execute("update review set is_hidden = %s where review_id = %s", (body.is_hidden, review_id))
        audit.log(db, request, user, f"{'Hid' if body.is_hidden else 'Showed'} review #REV-{review_id} ({review['product_name']})")
    if body.is_featured is not None:
        db.execute("update review set is_featured = %s where review_id = %s", (body.is_featured, review_id))
        audit.log(db, request, user, f"{'Featured' if body.is_featured else 'Unfeatured'} review #REV-{review_id}")
    return review_or_404(db, review_id)


@router.post("/{review_id}/reply")
def reply(db: Db, request: Request, review_id: int, body: ReviewReplyIn, user=Depends(require_admin)):
    review_or_404(db, review_id)
    db.execute("update review set reply = %s, replied_at = now() where review_id = %s", (body.reply.strip(), review_id))
    audit.log(db, request, user, f"Replied to customer review #REV-{review_id}")
    return review_or_404(db, review_id)


# ---------- customers ----------

@customer_router.get("/mine")
def my_reviews(db: Db, user=Depends(current_user)):
    return db.execute(f"{REVIEW_SELECT} where r.user_id = %s order by r.created_at desc", (user["user_id"],)).fetchall()


@customer_router.post("")
def write_review(db: Db, body: ReviewIn, user=Depends(current_user)):
    # only buyers whose order with this item was delivered, so every review is from a verified buyer
    bought = db.execute(
        """
        select 1 from order_item oi join "order" o on o.order_id = oi.order_id
        where o.user_id = %s and o.order_stat = 'Delivered' and oi.prod_var_id = %s limit 1
        """,
        (user["user_id"], body.prod_var_id),
    ).fetchone()
    if not bought:
        raise HTTPException(403, "You can review an item after your order with it is delivered")

    values = (body.rating, body.content.strip(), images_text(body.photos), body.is_anonymous)
    existing = db.execute(
        "select review_id from review where user_id = %s and prod_var_id = %s", (user["user_id"], body.prod_var_id)
    ).fetchone()
    if existing:
        # one review per item, writing again updates it
        db.execute("update review set rating = %s, content = %s, photos = %s, is_anonymous = %s where review_id = %s", (*values, existing["review_id"]))
        review_id = existing["review_id"]
    else:
        review_id = db.execute(
            "insert into review (user_id, prod_var_id, rating, content, photos, is_anonymous) values (%s, %s, %s, %s, %s, %s) returning review_id",
            (user["user_id"], body.prod_var_id, *values),
        ).fetchone()["review_id"]
    return review_or_404(db, review_id)


@customer_router.post("/uploads")
async def upload_review_photo(file: UploadFile = File(...), user=Depends(current_user)):
    return {"url": await store_image(file, "reviews/")}
