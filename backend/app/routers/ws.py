"""WebSocket endpoints for live order updates (see app/events.py).

The browser can't send an Authorization header on a WebSocket, so the Supabase access token goes in the ?token= query.
Messages are JSON: {"type": "order", "event": "...", "order_id", "order_num", "order_stat", "at"}. The server also sends
{"type": "ping"} every 25 s so proxies keep the connection open; the client may ignore it.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from .. import events
from ..db import pool
from ..deps import ADMIN_ROLES, user_from_token

router = APIRouter(prefix="/ws", tags=["ws"])

PING_SECONDS = 25


async def accept(ws: WebSocket, token: str | None) -> dict | None:
    """Checks the token before accepting. Closes with 4401 when it's missing or bad (the client then stops retrying)."""
    if not token or pool.closed:
        await ws.close(code=4401)
        return None
    try:
        with pool.connection() as conn:
            user = await asyncio.to_thread(user_from_token, conn, token)
    except HTTPException:
        await ws.close(code=4401)
        return None
    await ws.accept()
    return user


@asynccontextmanager
async def watching(topics: list[str]):
    q = events.subscribe(topics)
    try:
        yield q
    finally:
        events.unsubscribe(topics, q)


async def pump(ws: WebSocket, q: asyncio.Queue) -> None:
    # sends whatever lands in the queue; pings while it's quiet; ends when the client goes away
    async def reader():
        # we don't expect messages from the client, but reading is how a disconnect shows up
        while True:
            await ws.receive_text()

    reader_task = asyncio.create_task(reader())
    try:
        while True:
            if reader_task.done():
                return
            try:
                message = await asyncio.wait_for(q.get(), timeout=PING_SECONDS)
            except asyncio.TimeoutError:
                message = {"type": "ping"}
            await ws.send_json(message)
    except (WebSocketDisconnect, RuntimeError):
        return
    finally:
        reader_task.cancel()


@router.websocket("/orders/{order_id}")
async def one_order(ws: WebSocket, order_id: int, token: str | None = None):
    # the order's owner (Track your order page) or any admin
    user = await accept(ws, token)
    if not user:
        return
    with pool.connection() as conn:
        row = conn.execute('select user_id from "order" where order_id = %s', (order_id,)).fetchone()
    if not row or (row["user_id"] != user["user_id"] and user["role"] not in ADMIN_ROLES):
        await ws.close(code=4404)
        return
    async with watching([f"order:{order_id}"]) as q:
        await pump(ws, q)


@router.websocket("/me/orders")
async def my_orders(ws: WebSocket, token: str | None = None):
    # every order of the logged in customer (Track Order list)
    user = await accept(ws, token)
    if not user:
        return
    async with watching([f"user:{user['user_id']}"]) as q:
        await pump(ws, q)


@router.websocket("/admin/orders")
async def admin_orders(ws: WebSocket, token: str | None = None):
    user = await accept(ws, token)
    if not user:
        return
    if user["role"] not in ADMIN_ROLES:
        await ws.close(code=4403)
        return
    async with watching(["admin:orders"]) as q:
        await pump(ws, q)
