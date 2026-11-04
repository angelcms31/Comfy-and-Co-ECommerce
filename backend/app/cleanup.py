"""Deletes accounts DELETE_AFTER_DAYS after they were deactivated.

Runs when the API starts and every few hours while it's awake (Render's free plan sleeps, so it catches up on wake-up).
- No orders: the Supabase login is deleted, and the "user" row, cart, wishlist and reviews go with it (on delete cascade).
- Has orders: the orders must stay for the sales reports, so the profile is wiped instead (name, email, phone, address),
  the login stays banned and its email is changed, so the person can sign up again with the same email.
"""

import asyncio
import logging

from .config import DELETE_AFTER_DAYS
from .db import pool
from .supa import admin_client

log = logging.getLogger(__name__)
CHECK_EVERY_HOURS = 6


def anonymize(db, user_id: str) -> None:
    placeholder = f"deleted-{user_id}@deleted.comfyco.invalid"
    db.execute("delete from cart where user_id = %s", (user_id,))
    db.execute("delete from wishlist_col where user_id = %s", (user_id,))
    db.execute(
        """
        update "user" set full_name = 'Deleted user', email = %s, birthdate = null, mobile_no = null,
          st_add = null, postal = null, city_id = null, deleted_at = now()
        where user_id = %s
        """,
        (placeholder, user_id),
    )
    # if this fails the update above is rolled back and it's tried again next time
    admin_client().auth.admin.update_user_by_id(user_id, {"email": placeholder, "ban_duration": "876000h"})


def purge_deactivated(db) -> int:
    due = db.execute(
        """
        select u.user_id, exists (select 1 from "order" o where o.user_id = u.user_id) as has_orders
        from "user" u
        where u.deleted_at is null and u.deactivated_at < now() - make_interval(days => %s)
        """,
        (DELETE_AFTER_DAYS,),
    ).fetchall()

    done = 0
    for row in due:
        user_id = str(row["user_id"])
        try:
            if row["has_orders"]:
                anonymize(db, user_id)
            else:
                admin_client().auth.admin.delete_user(user_id)
            db.commit()
            done += 1
        except Exception:
            db.rollback()
            log.exception("could not delete deactivated account %s", user_id)
    return done


def run_once() -> int:
    with pool.connection() as conn:
        return purge_deactivated(conn)


async def run_forever() -> None:
    while True:
        try:
            deleted = await asyncio.to_thread(run_once)
            if deleted:
                log.info("deleted %s account(s) deactivated over %s days ago", deleted, DELETE_AFTER_DAYS)
        except Exception:
            log.exception("account cleanup failed")
        await asyncio.sleep(CHECK_EVERY_HOURS * 3600)