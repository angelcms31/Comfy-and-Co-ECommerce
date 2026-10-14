from fastapi import APIRouter, Depends, HTTPException
from psycopg import sql

from .. import queries
from ..db import Db
from ..deps import current_user
from ..schemas import ProfilePatch

router = APIRouter(prefix="/users", tags=["users"])


def update_profile(db, user_id: str, fields: dict):
    if not fields:
        return
    if fields.get("city_id") and not db.execute("select 1 from city where city_id = %s", (fields["city_id"],)).fetchone():
        raise HTTPException(400, "Please pick a valid city")
    query = sql.SQL('update "user" set {} where user_id = %s').format(
        sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields)
    )
    db.execute(query, (*fields.values(), user_id))


@router.get("/me")
def get_me(user=Depends(current_user)):
    return user


@router.patch("/me")
def patch_me(db: Db, body: ProfilePatch, user=Depends(current_user)):
    update_profile(db, user["user_id"], body.model_dump(exclude_unset=True))
    return queries.profile(db, user["user_id"])
