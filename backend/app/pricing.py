from datetime import date, datetime
from zoneinfo import ZoneInfo

from .config import TIMEZONE


def today() -> date:
    return datetime.now(ZoneInfo(TIMEZONE)).date()


def effective_price(v: dict, day: date | None = None) -> float:
    """pr_price while the promo is running, otherwise b_price (same rule as getEffectivePrice in the frontend)"""
    day = day or today()
    pr_price, start, end = v.get("pr_price"), v.get("pr_start"), v.get("pr_end")
    if pr_price is not None and start and end and pr_price < v["b_price"] and start <= day <= end:
        return pr_price
    return v["b_price"]


def on_promo(v: dict, day: date | None = None) -> bool:
    return effective_price(v, day) < v["b_price"]
