"""Settings > User Management: Super Admins add, edit and deactivate the other admins."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .. import audit
from ..db import Db
from ..deps import ADMIN_ROLES, require_super_admin
from ..schemas import AdminIn, AdminRoleIn, PasswordIn
from ..supa import admin_client

log = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/admins", tags=["admins"], dependencies=[Depends(require_super_admin)])

ROLE_LABEL = {"admin": "Admin", "super_admin": "Super Admin"}


def last_active(user_id) -> str | None:
    # Supabase Auth keeps the last login time
    try:
        return admin_client().auth.admin.get_user_by_id(str(user_id)).user.last_sign_in_at
    except Exception:
        return None


def admin_or_404(db, user_id: str) -> dict:
    row = db.execute(
        """
        select u.user_id, u.full_name, u.email, r.user_role as role, u.deactivated_at, u.date_added
        from "user" u join user_role r on r.user_role_id = u.user_role_id
        where u.user_id = %s and r.user_role = any(%s) and u.deleted_at is null
        """,
        (user_id, list(ADMIN_ROLES)),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Admin not found")
    return row


def check_not_self(target: dict, me: dict, what: str):
    if str(target["user_id"]) == str(me["user_id"]):
        raise HTTPException(400, f"You can't {what} your own account")


def check_not_super_admin(role: str):
    # the store has exactly one Super Admin, so no one else can be given that role
    if role == "super_admin":
        raise HTTPException(400, "There can only be one Super Admin. Pick the Admin role instead")


def role_id(db, role: str) -> int:
    return db.execute("select user_role_id from user_role where user_role = %s", (role,)).fetchone()["user_role_id"]


@router.get("")
def list_admins(db: Db):
    rows = db.execute(
        """
        select u.user_id, u.full_name, u.email, r.user_role as role, u.deactivated_at, u.date_added
        from "user" u join user_role r on r.user_role_id = u.user_role_id
        where r.user_role = any(%s) and u.deleted_at is null
        order by r.user_role desc, u.full_name
        """,
        (list(ADMIN_ROLES),),
    ).fetchall()
    for r in rows:
        r["last_active"] = last_active(r["user_id"])
    return rows


@router.post("")
def add_admin(db: Db, request: Request, body: AdminIn, me=Depends(require_super_admin)):
    check_not_super_admin(body.role)
    email = body.email.strip().lower()
    if db.execute('select 1 from "user" where lower(email) = %s', (email,)).fetchone():
        raise HTTPException(400, "An account with this email already exists")
    try:
        res = admin_client().auth.admin.create_user({"email": email, "password": body.password, "email_confirm": True})
    except Exception as e:
        raise HTTPException(400, str(e) or "Could not create the account")

    try:
        db.execute(
            'insert into "user" (user_id, user_role_id, full_name, email) values (%s, %s, %s, %s)',
            (res.user.id, role_id(db, body.role), body.full_name.strip(), email),
        )
        audit.log(db, request, me, f"Created new {ROLE_LABEL[body.role]} account: {body.full_name.strip()}")
        db.commit()
    except Exception:
        db.rollback()
        admin_client().auth.admin.delete_user(res.user.id)
        raise
    return admin_or_404(db, res.user.id)


@router.patch("/{user_id}/role")
def change_role(db: Db, request: Request, user_id: str, body: AdminRoleIn, me=Depends(require_super_admin)):
    target = admin_or_404(db, user_id)
    check_not_self(target, me, "change the role of")
    check_not_super_admin(body.role)
    db.execute('update "user" set user_role_id = %s where user_id = %s', (role_id(db, body.role), user_id))
    audit.log(db, request, me, f"Changed role of {target['full_name']} to {ROLE_LABEL[body.role]}")
    return admin_or_404(db, user_id)


@router.post("/{user_id}/password", status_code=204)
def reset_password(db: Db, request: Request, user_id: str, body: PasswordIn, me=Depends(require_super_admin)):
    target = admin_or_404(db, user_id)
    try:
        admin_client().auth.admin.update_user_by_id(str(user_id), {"password": body.password})
    except Exception:
        log.exception("password reset failed for %s", user_id)
        raise HTTPException(500, "Could not change the password, please try again")
    audit.log(db, request, me, f"Reset password of {target['full_name']}")
    return Response(status_code=204)


@router.post("/{user_id}/deactivate")
def deactivate(db: Db, request: Request, user_id: str, me=Depends(require_super_admin)):
    target = admin_or_404(db, user_id)
    check_not_self(target, me, "deactivate")
    if target["role"] == "super_admin":
        raise HTTPException(400, "Super Admin accounts are protected. Change the role to Admin first")
    try:
        # banning the login stops new logins, deactivated_at also blocks their current session
        admin_client().auth.admin.update_user_by_id(str(user_id), {"ban_duration": "876000h"})
    except Exception:
        log.exception("deactivate failed for %s", user_id)
        raise HTTPException(500, "Could not deactivate the account, please try again")
    db.execute('update "user" set deactivated_at = now() where user_id = %s', (user_id,))
    audit.log(db, request, me, f"Deactivated admin account: {target['full_name']}")
    return admin_or_404(db, user_id)


@router.post("/{user_id}/reactivate")
def reactivate(db: Db, request: Request, user_id: str, me=Depends(require_super_admin)):
    target = admin_or_404(db, user_id)
    try:
        admin_client().auth.admin.update_user_by_id(str(user_id), {"ban_duration": "none"})
    except Exception:
        log.exception("reactivate failed for %s", user_id)
        raise HTTPException(500, "Could not reactivate the account, please try again")
    db.execute('update "user" set deactivated_at = null where user_id = %s', (user_id,))
    audit.log(db, request, me, f"Reactivated admin account: {target['full_name']}")
    return admin_or_404(db, user_id)
