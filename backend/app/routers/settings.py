"""Settings > Store Info & Currency and Security & Audit Logs. Values live in the store_setting table."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from .. import audit, queries
from ..config import SETTING_DEFAULTS
from ..db import Db
from ..deps import require_admin, require_super_admin
from ..schemas import PolicySettingsIn, RegionalSettingsIn, SecuritySettingsIn, StoreSettingsIn

router = APIRouter(tags=["settings"])

SECTION_LABEL = {"store": "store info", "policies": "order & refund policies", "regional": "regional & tax settings", "security": "security policies"}

# words in audit_log.action for the "Filter by action" menu
ACTION_FILTERS = {
    "products": ["product"],
    "orders": ["order"],
    "reviews": ["review"],
    "admins": ["admin account", "role of", "password of"],
    "settings": ["settings", "policies", "logged out"],
}


def save(db, key: str, value: dict) -> dict:
    db.execute(
        """
        insert into store_setting (key, value, updated_at) values (%s, %s, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
        """,
        (key, Jsonb(value)),
    )
    return queries.setting(db, key)


@router.get("/store-info")
def store_info(db: Db):
    # public: name, email, phone, address and hours for the Contact Us page and footer
    return queries.setting(db, "store")


@router.get("/admin/settings", dependencies=[Depends(require_admin)])
def all_settings(db: Db):
    return {key: queries.setting(db, key) for key in SETTING_DEFAULTS}


def section_endpoint(key: str, model: type[BaseModel]):
    def update(db: Db, request: Request, body: model, me=Depends(require_super_admin)):  # type: ignore[valid-type]
        current = queries.setting(db, key)
        saved = save(db, key, {**current, **body.model_dump(mode="json")})
        audit.log(db, request, me, f"Updated {SECTION_LABEL[key]}")
        return saved

    router.put(f"/admin/settings/{key}", name=f"update_{key}_settings")(update)


section_endpoint("store", StoreSettingsIn)
section_endpoint("policies", PolicySettingsIn)
section_endpoint("regional", RegionalSettingsIn)
section_endpoint("security", SecuritySettingsIn)


@router.post("/admin/settings/force-logout")
def force_logout(db: Db, request: Request, me=Depends(require_super_admin)):
    # every admin login made before now stops working (checked in deps.current_user), including the one who pressed it
    security = queries.setting(db, "security")
    saved = save(db, "security", {**security, "sessions_valid_after": datetime.now(timezone.utc).replace(microsecond=0).isoformat()})
    audit.log(db, request, me, "Logged out all active admin sessions")
    return saved


@router.get("/admin/audit-logs", dependencies=[Depends(require_super_admin)])
def audit_logs(
    db: Db,
    admin: str | None = None,
    action: Literal["products", "orders", "reviews", "admins", "settings"] | None = None,
    page: int = 1,
    page_size: int = 10,
):
    where, params = [], []
    if admin:
        where.append("l.user_id = %s")
        params.append(admin)
    if action:
        where.append("(" + " or ".join(["l.action ilike %s"] * len(ACTION_FILTERS[action])) + ")")
        params += [f"%{w}%" for w in ACTION_FILTERS[action]]
    clause = ("where " + " and ".join(where)) if where else ""

    total = db.execute(f"select count(*) as n from audit_log l {clause}", params).fetchone()["n"]
    rows = db.execute(
        f"""
        select l.log_id, l.created_at, l.action, l.ip_address, l.device, u.full_name as admin_name, r.user_role as role
        from audit_log l
        left join "user" u on u.user_id = l.user_id
        left join user_role r on r.user_role_id = u.user_role_id
        {clause}
        order by l.created_at desc
        limit %s offset %s
        """,
        (*params, page_size, (max(page, 1) - 1) * page_size),
    ).fetchall()
    return {"total": total, "rows": rows}
