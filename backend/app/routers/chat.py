"""Store chat. Anyone can ask the FAQ bot; logged-in customers get a saved chat that admins answer from the admin Chats page."""

from fastapi import APIRouter, Depends, HTTPException

from .. import chatbot, queries
from ..db import Db
from ..deps import ADMIN_ROLES, current_user, require_admin
from ..schemas import ChatIn, ChatResolveIn

router = APIRouter(prefix="/chat", tags=["chat"])
admin_router = APIRouter(prefix="/admin/chats", tags=["chat"], dependencies=[Depends(require_admin)])

HANDOFF_TEXT = (
    "Got it! I've asked our team to join this chat. A staff member will reply here during store hours ({hours}). "
    "You can keep browsing, the chat stays saved."
)
RESOLVED_TEXT = "Our team marked this chat as resolved. I'm here if you have more questions, or tap “Talk to staff” anytime."


def require_customer(user: dict = Depends(current_user)) -> dict:
    if user["role"] in ADMIN_ROLES:
        raise HTTPException(403, "Admins answer chats from the admin Chats page")
    return user


# account names that are a role, not a person: their replies just say "Admin"
GENERIC_NAMES = {"admin", "super admin", "superadmin", "administrator"}


def staff_label(full_name: str | None) -> str:
    # every staff reply shows as an Admin, e.g. "Angel (Admin)"; Super Admin is never shown to customers
    name = (full_name or "").strip()
    if not name or name.lower() in GENERIC_NAMES:
        return "Admin"
    return f"{name.split()[0]} (Admin)"


def messages_of(db, thread_id: int) -> list[dict]:
    rows = db.execute(
        """
        select m.message_id, m.sender, m.body, m.created_at, u.full_name as admin_full_name
        from chat_message m left join "user" u on u.user_id = m.admin_id
        where m.thread_id = %s order by m.created_at, m.message_id
        """,
        (thread_id,),
    ).fetchall()
    for r in rows:
        full = r.pop("admin_full_name")
        r["admin_name"] = staff_label(full) if r["sender"] == "admin" else None
    return rows


def add_message(db, thread_id: int, sender: str, body: str, admin_id=None):
    db.execute("insert into chat_message (thread_id, sender, admin_id, body) values (%s, %s, %s, %s)", (thread_id, sender, admin_id, body))
    db.execute("update chat_thread set last_message_at = now() where thread_id = %s", (thread_id,))


def thread_of(db, user_id, create: bool = False) -> dict | None:
    row = db.execute("select * from chat_thread where user_id = %s", (user_id,)).fetchone()
    if row or not create:
        return row
    return db.execute("insert into chat_thread (user_id) values (%s) returning *", (user_id,)).fetchone()


def hand_off(db, thread: dict):
    if not thread["needs_staff"]:
        db.execute("update chat_thread set needs_staff = true where thread_id = %s", (thread["thread_id"],))
        thread["needs_staff"] = True
    add_message(db, thread["thread_id"], "bot", HANDOFF_TEXT.format(hours=queries.setting(db, "store")["hours"]))


def customer_view(db, thread: dict | None) -> dict:
    return {
        "needs_staff": bool(thread and thread["needs_staff"]),
        "messages": messages_of(db, thread["thread_id"]) if thread else [],
        "suggestions": chatbot.SUGGESTIONS,
    }


# ---------- everyone ----------

@router.post("/faq")
def faq(db: Db, body: ChatIn):
    # guests: answered and forgotten, nothing is saved. A handoff tells the page to ask them to log in.
    reply = chatbot.answer(db, body.body)
    return {**reply, "suggestions": chatbot.SUGGESTIONS}


# ---------- customers ----------

@router.get("")
def my_chat(db: Db, user=Depends(require_customer)):
    thread = thread_of(db, user["user_id"])
    if thread:
        db.execute("update chat_thread set customer_read_at = now() where thread_id = %s", (thread["thread_id"],))
    return customer_view(db, thread)


@router.get("/unread")
def my_unread(db: Db, user=Depends(require_customer)):
    # staff replies the customer hasn't seen yet, for the badge on the chat button
    row = db.execute(
        """
        select count(*) as n from chat_message m join chat_thread t using (thread_id)
        where t.user_id = %s and m.sender = 'admin' and m.created_at > t.customer_read_at
        """,
        (user["user_id"],),
    ).fetchone()
    return {"unread": row["n"]}


@router.post("/messages")
def send(db: Db, body: ChatIn, user=Depends(require_customer)):
    thread = thread_of(db, user["user_id"], create=True)
    text = body.body.strip()
    add_message(db, thread["thread_id"], "customer", text)

    # while staff is on the chat the bot stays quiet, except when they ask for staff again
    reply = chatbot.answer(db, text, user)
    if reply["handoff"]:
        hand_off(db, thread)
    elif not thread["needs_staff"]:
        add_message(db, thread["thread_id"], "bot", reply["body"])

    db.execute("update chat_thread set customer_read_at = now() where thread_id = %s", (thread["thread_id"],))
    return customer_view(db, thread)


@router.post("/staff")
def ask_staff(db: Db, user=Depends(require_customer)):
    thread = thread_of(db, user["user_id"], create=True)
    if not thread["needs_staff"]:
        hand_off(db, thread)
    return customer_view(db, thread)


# ---------- admins ----------

THREAD_SELECT = """
    select t.thread_id, t.user_id, t.needs_staff, t.last_message_at, u.full_name as customer_name, u.email, u.mobile_no,
      (select count(*) from chat_message m where m.thread_id = t.thread_id and m.sender = 'customer' and m.created_at > t.admin_read_at) as unread,
      (select json_build_object('sender', m.sender, 'body', m.body) from chat_message m
        where m.thread_id = t.thread_id order by m.created_at desc, m.message_id desc limit 1) as last_message
    from chat_thread t join "user" u on u.user_id = t.user_id
"""


def admin_thread_or_404(db, thread_id: int) -> dict:
    row = db.execute(f"{THREAD_SELECT} where t.thread_id = %s", (thread_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Chat not found")
    return row


def admin_view(db, thread_id: int) -> dict:
    db.execute("update chat_thread set admin_read_at = now() where thread_id = %s", (thread_id,))
    thread = admin_thread_or_404(db, thread_id)
    orders = queries.orders_with_items(db, "where o.user_id = %s", (thread["user_id"],))
    return {
        "thread": thread,
        "messages": messages_of(db, thread_id),
        # the customer's latest orders, so staff can answer without leaving the chat
        "orders": [{k: o[k] for k in ("order_id", "order_num", "order_stat", "total_amt", "placed_at")} for o in orders[:3]],
    }


@admin_router.get("")
def list_chats(db: Db):
    # chats waiting for staff first, then the most recent
    return db.execute(f"{THREAD_SELECT} order by t.needs_staff desc, t.last_message_at desc").fetchall()


@admin_router.get("/unread")
def unread_chats(db: Db):
    # chats where a customer asked for staff and wrote something no admin has opened yet
    row = db.execute(
        """
        select count(*) as n from chat_thread t
        where t.needs_staff and exists (
          select 1 from chat_message m where m.thread_id = t.thread_id and m.sender = 'customer' and m.created_at > t.admin_read_at
        )
        """
    ).fetchone()
    return {"unread": row["n"]}


@admin_router.get("/{thread_id}")
def open_chat(db: Db, thread_id: int):
    return admin_view(db, thread_id)


@admin_router.post("/{thread_id}/messages")
def reply(db: Db, thread_id: int, body: ChatIn, user=Depends(require_admin)):
    admin_thread_or_404(db, thread_id)
    # a staff reply keeps the bot quiet until the chat is marked resolved
    db.execute("update chat_thread set needs_staff = true where thread_id = %s", (thread_id,))
    add_message(db, thread_id, "admin", body.body.strip(), user["user_id"])
    return admin_view(db, thread_id)


@admin_router.patch("/{thread_id}")
def resolve(db: Db, thread_id: int, body: ChatResolveIn):
    thread = admin_thread_or_404(db, thread_id)
    if body.resolved and thread["needs_staff"]:
        db.execute("update chat_thread set needs_staff = false where thread_id = %s", (thread_id,))
        add_message(db, thread_id, "bot", RESOLVED_TEXT)
    elif not body.resolved and not thread["needs_staff"]:
        db.execute("update chat_thread set needs_staff = true where thread_id = %s", (thread_id,))
    return admin_view(db, thread_id)
