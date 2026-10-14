from fastapi import APIRouter, Depends, HTTPException

from ..db import Db
from ..deps import require_admin
from ..schemas import ReviewHiddenIn

router = APIRouter(prefix="/admin/reviews", tags=["reviews"], dependencies=[Depends(require_admin)])


def reviews_for(db, where: str = "", params: tuple = ()) -> dict:
    # review has no created_at yet (SCHEMA_GAPS #1), so newest = highest id
    rows = db.execute(
        f"""
        select r.*, u.full_name as reviewer_name, p.product_id, p.product_name, v.prod_attr
        from review r
        join "user" u on u.user_id = r.user_id
        join prod_var v on v.prod_var_id = r.prod_var_id
        join product p on p.product_id = v.product_id
        {where}
        order by r.review_id desc
        """,
        params,
    ).fetchall()

    breakdown = {str(n): 0 for n in range(1, 6)}
    for r in rows:
        breakdown[str(r["rating"])] += 1
    average = round(sum(r["rating"] for r in rows) / len(rows), 1) if rows else 0

    return {"summary": {"average": average, "count": len(rows), "breakdown": breakdown}, "reviews": rows}


@router.get("")
def all_reviews(db: Db):
    return reviews_for(db)


@router.patch("/{review_id}")
def set_hidden(review_id: int, body: ReviewHiddenIn):
    # needs an is_hidden column on review, waiting on the group's decision (SCHEMA_GAPS #1)
    raise HTTPException(501, "Hiding reviews needs the is_hidden column on the review table")
