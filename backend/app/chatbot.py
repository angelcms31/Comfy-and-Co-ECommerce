"""FAQ bot for the store chat: matches keywords to a fixed answer. No AI, so it's free and always answers the same way.

Store details come from the Settings page (store_setting), so the answers stay right when a Super Admin edits them.
"""

import re

from . import queries
from .config import COURIER

# the buttons under the chat; each one is sent as a message, so its text has to match a topic below
SUGGESTIONS = ["Shipping & delivery", "Payment methods", "Track my order", "Returns & refunds", "Store hours & location", "Talk to staff"]

GREETING = "Hi! I'm the comfy&co assistant. Ask me about shipping, payment, your orders or returns, or pick a topic below."
FALLBACK = "Sorry, I'm not sure about that one. Try a topic below, or tap “Talk to staff” and someone from our team will reply."


def peso(n) -> str:
    return f"₱{float(n):,.0f}"


def shipping(db, user):
    free = queries.setting(db, "policies").get("free_shipping_threshold") or 0
    text = (
        f"We deliver through {COURIER}. The fee depends on how far you are from our store in Intramuros and the vehicle "
        "your items need (a motorcycle for small items, a van or truck for furniture); you'll see the exact amount at checkout "
        "before you place the order. Store pickup is free. Orders usually arrive 3–5 days after they ship."
    )
    if free:
        text += f" Delivery is free on orders of {peso(free)} or more."
    return text


def payment(db, user):
    return (
        "We accept GCash and Cash on Delivery. For GCash, scan our QR code after checkout and enter the reference number "
        "so we can check the payment. For COD, please prepare the exact amount when your order arrives."
    )


STATUS_TEXT = {
    "Pending": "is being prepared and hasn't shipped yet",
    "Shipped": "is on the way",
    "Delivered": "was delivered",
    "Cancelled": "was cancelled",
    "Returned": "was returned to the store after the rider couldn't deliver it",
}


def order_status(db, user):
    if not user:
        return "Log in and open Track order to see where your orders are. Once you're logged in, I can check your latest order here too."
    orders = queries.orders_with_items(db, "where o.user_id = %s", (user["user_id"],))
    if not orders:
        return "You don't have any orders yet. Once you check out, you can follow them in Track order."
    o = orders[0]
    text = f"Your latest order #{o['order_num']} ({peso(o['total_amt'])}) {STATUS_TEXT.get(o['order_stat'], 'is ' + o['order_stat'])}."
    if o.get("_temp_payment_status"):
        text += f" GCash payment: {o['_temp_payment_status']}."
    if len(orders) > 1:
        text += f" You have {len(orders)} orders in total, all listed in Track order."
    return text


def cancel(db, user):
    return (
        "You can cancel an order yourself from Track order while it hasn't shipped yet. "
        "If you already paid with GCash, tap “Talk to staff” so we can cancel it and return your payment."
    )


def returns(db, user):
    policies = queries.setting(db, "policies")
    return (
        f"Our policy: {policies['return_policy']}. If an item arrives damaged or wrong, open the delivered order in Track order "
        f"and request a refund with photos of the item. Refunds go back through: {policies['refund_method']}."
    )


def store_info(db, user):
    store = queries.setting(db, "store")
    return (
        f"We're open {store['hours']} at {store['address']}. "
        f"You can call {store['phone']} or email {store['support_email']}. Store pickup is free."
    )


def stock(db, user):
    return (
        "Each product page shows how many are left of every color or size, and sold-out items are listed last. "
        "Waiting for a restock? Tap “Talk to staff” and tell us the product."
    )


def account(db, user):
    return (
        "To change your name, mobile number or address, open My Profile. "
        "Forgot your password? Use “Forgot password” on the login page and we'll email you a code."
    )


def about(db, user):
    store = queries.setting(db, "store")
    return (
        f"This is {store['name']}, an online furniture store from Manila. We make warm, space-smart furniture for condos, "
        "renters and first-time setups, with exact sizes listed on every product. Read more on our About page."
    )


def greeting(db, user):
    return GREETING


def thanks(db, user):
    return "You're welcome! Anything else I can help with?"


HANDOFF = "staff"

# (topic, keywords, answer). When two topics match equally, the one listed first wins, so "cancel my order" is about cancelling.
TOPICS = [
    (HANDOFF, ["staff", "human", "agent", "person", "talk to", "representative", "tao", "kausap"], None),
    ("cancel", ["cancel", "icancel", "kanselahin"], cancel),
    ("returns", ["return", "refund", "damage", "damaged", "broken", "defect", "wrong item", "sira", "replace", "exchange", "ibalik"], returns),
    ("order", ["order", "track", "status", "where is my", "nasaan", "package", "parcel", "dumating"], order_status),
    ("shipping", ["ship", "shipping", "deliver", "delivery", "courier", "fee", "arrive", "how long", "gaano katagal", "j&t", "lbc", "ninja van", "flash express", "pickup", "pick up"], shipping),
    ("payment", ["pay", "payment", "gcash", "cod", "cash", "bayad", "magbayad", "card", "installment"], payment),
    ("store", ["hours", "open", "location", "address", "where are you", "branch", "contact", "phone", "email"], store_info),
    ("stock", ["stock", "available", "availability", "sold out", "restock", "meron pa", "mayroon pa"], stock),
    ("account", ["password", "account", "profile", "login", "log in", "sign up", "register"], account),
    ("about", ["name", "website", "site", "who are you", "about", "comfy", "comfy&co", "what is this store", "what do you sell", "sino kayo", "ano to"], about),
    ("thanks", ["thank", "thanks", "thank you", "salamat", "ty"], thanks),
    ("greeting", ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "kumusta", "musta"], greeting),
]
ANSWERS = {name: fn for name, _, fn in TOPICS}


def matches(text: str, keyword: str) -> bool:
    # whole words, so "hi" doesn't match "shipping"; a plural s is fine ("orders", "fees")
    return re.search(rf"(?<![a-z]){re.escape(keyword)}s?(?![a-z])", text) is not None


def topic_of(text: str) -> str | None:
    text = text.lower()
    best, best_hits = None, 0
    for name, keywords, _ in TOPICS:
        hits = sum(1 for k in keywords if matches(text, k))
        if hits > best_hits:
            best, best_hits = name, hits
    return best


def answer(db, text: str, user: dict | None = None) -> dict:
    """{"body": the reply (None for a handoff), "handoff": True when they asked for a person}"""
    topic = topic_of(text)
    if topic == HANDOFF:
        return {"body": None, "handoff": True}
    if topic is None:
        return {"body": FALLBACK, "handoff": False}
    return {"body": ANSWERS[topic](db, user), "handoff": False}
