from fastapi import APIRouter, Depends, HTTPException, Request

from .. import audit
from ..config import CONTACT_EMAIL_TO
from ..db import Db
from ..deps import require_admin
from ..schemas import ContactIn

router = APIRouter(tags=["contact"])

SUBJECTS = {
    "order": "Order or delivery concern",
    "refund": "Refund request",
    "product": "Product question",
    "other": "Something else",
}
MAX_PER_HOUR = 10  # from one visitor or email address


# saved for the admin Messages page, then the website opens Gmail with the message so the customer can press Send
@router.post("/contact")
def send_message(db: Db, request: Request, body: ContactIn):
    name, message = body.name.strip(), body.message.strip()
    if not name or not message:
        raise HTTPException(400, "Please fill in your name and message")
    ip = audit.client_ip(request)
    recent = db.execute(
        """
        select count(*) as total from contact_message
        where created_at > now() - interval '1 hour' and (ip_address = %s or lower(email) = lower(%s))
        """,
        (ip, body.email),
    ).fetchone()
    if recent["total"] >= MAX_PER_HOUR:
        raise HTTPException(429, "You've sent a lot of messages. Please try again later.")

    db.execute(
        "insert into contact_message (name, email, subject, message, ip_address) values (%s, %s, %s, %s, %s)",
        (name, body.email, SUBJECTS[body.subject], message, ip),
    )
    return {"to": CONTACT_EMAIL_TO or None}


@router.get("/admin/messages", dependencies=[Depends(require_admin)])
def list_messages(db: Db):
    return db.execute(
        "select message_id, name, email, subject, message, created_at from contact_message order by created_at desc limit 200"
    ).fetchall()
