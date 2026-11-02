import base64
import json
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException

from . import queries
from .db import Db
from .supa import admin_client

ADMIN_ROLES = ("admin", "super_admin")


def get_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in first")
    return authorization.split(" ", 1)[1]


def issued_at(token: str) -> datetime | None:
    # the token was already checked by Supabase, this only reads its "iat" (issued at) field
    try:
        payload = token.split(".")[1]
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return datetime.fromtimestamp(data["iat"], tz=timezone.utc)
    except (IndexError, KeyError, ValueError):
        return None


def current_user(db: Db, token: str = Depends(get_token)) -> dict:
    try:
        res = admin_client().auth.get_user(token)
    except Exception:
        raise HTTPException(401, "Your session has expired, please log in again")
    if not res or not res.user:
        raise HTTPException(401, "Your session has expired, please log in again")

    user = queries.profile(db, res.user.id)
    if not user:
        raise HTTPException(401, "Account not found")

    if user["role"] in ADMIN_ROLES:
        if user["deactivated_at"]:
            raise HTTPException(403, "This account has been deactivated")
        # "Force logout all active sessions" in Settings: admin logins from before that time stop working
        cutoff = queries.setting(db, "security").get("sessions_valid_after")
        iat = issued_at(token)
        if cutoff and iat and iat < datetime.fromisoformat(cutoff):
            raise HTTPException(401, "You were logged out by a Super Admin, please log in again")
    return user


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in ADMIN_ROLES:
        raise HTTPException(403, "Admins only")
    return user


def require_super_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "super_admin":
        raise HTTPException(403, "Only a Super Admin can do this")
    return user
