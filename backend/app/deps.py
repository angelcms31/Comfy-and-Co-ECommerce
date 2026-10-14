from fastapi import Depends, Header, HTTPException

from . import queries
from .db import Db
from .supa import admin_client


def get_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in first")
    return authorization.split(" ", 1)[1]


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
    return user


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Admins only")
    return user
