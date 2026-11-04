import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg import sql

from .. import queries
from ..db import Db
from ..deps import ADMIN_ROLES, current_user
from ..schemas import ProfilePatch
from ..supa import admin_client

router = APIRouter(prefix="/users", tags=["users"])
log = logging.getLogger(__name__)


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


# the Supabase Auth login is banned, and deactivated_at starts the 30 days before app/cleanup.py deletes the account
@router.post("/me/deactivate", status_code=204)
def deactivate_me(db: Db, user=Depends(current_user)):
    if user["role"] in ADMIN_ROLES:
        raise HTTPException(400, "Admin accounts can't be deactivated here")
    try:
        # user_id comes back from psycopg as a UUID object, supabase wants a string
        admin_client().auth.admin.update_user_by_id(str(user["user_id"]), {"ban_duration": "876000h"})
    except Exception:
        log.exception("deactivate failed for %s", user["user_id"])
        raise HTTPException(500, "Could not deactivate the account, please try again")
    db.execute('update "user" set deactivated_at = now() where user_id = %s', (user["user_id"],))
    return Response(status_code=204)
