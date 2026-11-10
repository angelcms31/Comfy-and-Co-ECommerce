"""Sends email through an SMTP account (Gmail with an App Password works out of the box).

.env:
  SMTP_USER=yourstore@gmail.com      the Gmail account that sends
  SMTP_PASS=xxxx xxxx xxxx xxxx      a Gmail App Password (Google Account > Security > 2-Step Verification > App passwords)
  SMTP_FROM_NAME=Comfy&Co            optional, the sender name people see
  SMTP_HOST / SMTP_PORT              optional, default smtp.gmail.com:587
"""

import html
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from .config import SMTP_FROM_NAME, SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_USER

log = logging.getLogger("mailer")


class MailError(Exception):
    pass


def is_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASS)


def send(to: str, subject: str, text: str, html_body: str | None = None, reply_to: str | None = None) -> None:
    """one email; raises MailError with a plain message when it can't be sent"""
    if not is_configured():
        raise MailError("Email isn't set up on the server yet (SMTP_USER / SMTP_PASS)")
    msg = EmailMessage()
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_USER))
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        log.error("SMTP login failed for %s: check SMTP_PASS is a Gmail App Password", SMTP_USER)
        raise MailError("The store's email account refused the login")
    except (smtplib.SMTPException, OSError) as e:
        log.error("SMTP send to %s failed: %s", to, e)
        raise MailError("The email couldn't be sent right now. Please try again")


# ---------- a small branded layout for the HTML version ----------

def layout(title: str, lines: list[str], footer: str = "") -> str:
    """lines are already-escaped HTML paragraphs"""
    body = "".join(f'<p style="margin:0 0 12px;line-height:1.55">{l}</p>' for l in lines)
    return f"""
<div style="background:#f8f5ee;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a201d">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 28px 20px;border:1px solid #e5e1d8">
    <p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#1f3d33;font-weight:700">Comfy&amp;Co</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#1f3d33">{html.escape(title)}</h1>
    {body}
    <p style="margin:20px 0 0;font-size:12px;color:#5c6b65">{footer}</p>
  </div>
</div>"""


def quote(text: str) -> str:
    """the customer's message as an indented block, newlines kept"""
    return (
        '<div style="margin:8px 0 16px;padding:12px 16px;background:#f8f5ee;border-left:3px solid #1f3d33;border-radius:8px;white-space:pre-wrap">'
        + html.escape(text)
        + "</div>"
    )
