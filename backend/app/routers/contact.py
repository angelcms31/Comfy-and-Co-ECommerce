import html

from fastapi import APIRouter, HTTPException, Request

from .. import audit, mailer, queries
from ..config import CONTACT_EMAIL_TO
from ..db import Db
from ..schemas import ContactIn

router = APIRouter(tags=["contact"])

SUBJECTS = {
    "order": "Order or delivery concern",
    "refund": "Refund request",
    "product": "Product question",
    "other": "Something else",
}
MAX_PER_HOUR = 10  # from one visitor or email address


# emails the message to the store inbox and a copy (receipt) to the customer; a row is kept as a log and for the rate limit
@router.post("/contact")
def send_message(db: Db, request: Request, body: ContactIn):
    name, message = body.name.strip(), body.message.strip()
    if not name or not message:
        raise HTTPException(400, "Please fill in your name and message")
    if not mailer.is_configured():
        raise HTTPException(503, "Sending messages isn't set up yet. Please email us directly for now")

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

    store = queries.setting(db, "store")
    inbox = CONTACT_EMAIL_TO or store["support_email"]
    subject = SUBJECTS[body.subject]

    # 1. to the store
    try:
        mailer.send(
            to=inbox,
            reply_to=f"{name} <{body.email}>",
            subject=f"[Contact Us] {subject} – {name}",
            text=f"{subject}\nFrom: {name} <{body.email}>\n\n{message}\n\nReply to this email to answer {name}.",
            html_body=mailer.layout(
                f"New message: {subject}",
                [
                    f"<b>From:</b> {html.escape(name)} &lt;<a href='mailto:{html.escape(body.email)}'>{html.escape(body.email)}</a>&gt;",
                    mailer.quote(message),
                    f"Press <b>Reply</b> to answer {html.escape(name)} directly.",
                ],
                footer="Sent from the Contact Us page of the Comfy&amp;Co website.",
            ),
        )
    except mailer.MailError as e:
        raise HTTPException(502, str(e))

    db.execute(
        "insert into contact_message (name, email, subject, message, ip_address) values (%s, %s, %s, %s, %s)",
        (name, body.email, subject, message, ip),
    )

    # 2. receipt to the customer (the store already has the message, so a failure here isn't an error)
    try:
        mailer.send(
            to=body.email,
            reply_to=inbox,
            subject=f"We got your message – {store['name']}",
            text=(
                f"Hi {name},\n\nThanks for reaching out. We've received your message and sent it to our team at {inbox}. "
                f"We usually reply within 1–2 business days.\n\nYour message ({subject}):\n{message}\n\n"
                f"{store['name']} · {store['phone']} · {store['hours']}"
            ),
            html_body=mailer.layout(
                "We got your message",
                [
                    f"Hi {html.escape(name)},",
                    f"Thanks for reaching out. Your message has been sent to our team at <b>{html.escape(inbox)}</b>. We usually reply within 1–2 business days.",
                    f"<b>Your message</b> <span style='color:#5c6b65'>({html.escape(subject)})</span>" + mailer.quote(message),
                ],
                footer=f"{html.escape(store['name'])} · {html.escape(store['phone'])} · {html.escape(store['hours'])}<br>{html.escape(store['address'])}",
            ),
        )
        receipt = True
    except mailer.MailError:
        receipt = False
    return {"to": inbox, "receipt": receipt}
