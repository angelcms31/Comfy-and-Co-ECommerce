"""Writes a row to audit_log for every change an admin makes (shown in Settings > Security & Audit Logs)."""

from fastapi import Request


def device_of(user_agent: str) -> str:
    ua = user_agent.lower()
    if "ipad" in ua or "tablet" in ua:
        return "Tablet"
    if "mobi" in ua or "android" in ua:
        return "Mobile"
    return "Desktop"


def client_ip(request: Request) -> str | None:
    # Render puts the visitor's address in X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def log(db, request: Request, user: dict, action: str) -> None:
    db.execute(
        "insert into audit_log (user_id, action, ip_address, device) values (%s, %s, %s, %s)",
        (user["user_id"], action, client_ip(request), device_of(request.headers.get("user-agent", ""))),
    )
