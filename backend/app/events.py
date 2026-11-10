"""Live order updates over WebSocket (routers/ws.py).

Anything that changes an order calls order_changed(...) and every open socket watching that order, its owner, or the
admin Orders page gets a small JSON message right away, so the pages reload without polling.

Topics: "order:<order_id>" (one order), "user:<user_id>" (all of a customer's orders), "admin:orders" (every order).
In-process only: it covers one uvicorn process, which is how the app runs on Render. Route handlers are plain `def`
functions running in a thread, so publishing hops onto the event loop with call_soon_threadsafe.
"""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone

loop: asyncio.AbstractEventLoop | None = None  # set in main.lifespan
_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(topics: list[str]) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    for t in topics:
        _subscribers[t].add(q)
    return q


def unsubscribe(topics: list[str], q: asyncio.Queue) -> None:
    for t in topics:
        _subscribers[t].discard(q)
        if not _subscribers[t]:
            del _subscribers[t]


def publish(topics: list[str], message: dict) -> None:
    if loop is None or loop.is_closed():
        return
    seen: set[int] = set()

    def go():
        # a queue in two of the topics (e.g. an admin watching one order) gets the message once
        for t in topics:
            for q in list(_subscribers.get(t, ())):
                if id(q) not in seen:
                    seen.add(id(q))
                    _deliver_one(q, message)

    # a beat later, so the request that made the change has committed by the time the page reloads
    loop.call_soon_threadsafe(lambda: loop.call_later(0.3, go))


def _deliver_one(q: asyncio.Queue, message: dict) -> None:
    try:
        q.put_nowait(message)
    except asyncio.QueueFull:
        pass


def notify(db, order_id: int, event: str, **extra) -> None:
    """order_changed for an order by id, called by the routers after they commit a change"""
    order = db.execute('select order_id, order_num, user_id, order_stat from "order" where order_id = %s', (order_id,)).fetchone()
    if order:
        order_changed(order, event, **extra)


def order_changed(order: dict, event: str, **extra) -> None:
    """order: a row with order_id, order_num, user_id and order_stat. event: what happened, e.g. 'delivered'."""
    publish(
        [f"order:{order['order_id']}", f"user:{order['user_id']}", "admin:orders"],
        {
            "type": "order",
            "event": event,
            "order_id": order["order_id"],
            "order_num": order["order_num"],
            "order_stat": order["order_stat"],
            "at": datetime.now(timezone.utc).isoformat(),
            **extra,
        },
    )
