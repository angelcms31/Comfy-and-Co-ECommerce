"""Lalamove delivery: which vehicle an order needs, how far the customer is from the store, and what the trip costs.

The vehicle rate card and the store's location come from Settings > Delivery (queries.setting(db, "delivery")).
Addresses are located with OpenStreetMap's free geocoder and the road distance comes from the OSRM demo server,
the same services the tracking map in the frontend uses (frontend/src/lib/tracking.ts).
"""

import math
import secrets
from functools import lru_cache

import httpx
from fastapi import HTTPException

USER_AGENT = "ComfyAndCo-Ecommerce/1.0 (student project; comfyandco@gmail.com)"
TIMEOUT = 8.0
# an item with no size or weight saved can't be measured, so the order needs at least this vehicle (index in the rate card)
UNMEASURED_MIN_VEHICLE = 3  # MPV 600 kg


# ---------- vehicle ----------

def sorted_dims(length: float, width: float, height: float) -> tuple[float, float, float]:
    return tuple(sorted((float(length), float(width), float(height)), reverse=True))  # type: ignore[return-value]


def item_fits(item: dict, vehicle: dict) -> bool:
    # the item can be turned any way, so its longest side only has to fit the vehicle's longest side, and so on
    a = sorted_dims(item["length_cm"], item["width_cm"], item["height_cm"])
    b = sorted_dims(vehicle["length_cm"], vehicle["width_cm"], vehicle["height_cm"])
    return all(x <= y for x, y in zip(a, b))


def volume_m3(d: dict) -> float:
    return float(d["length_cm"]) * float(d["width_cm"]) * float(d["height_cm"]) / 1_000_000


def pick_vehicle(items: list[dict], vehicles: list[dict]) -> dict:
    """The smallest vehicle (rate card order) that every item fits in, with the total weight and volume within its limits.

    items: dicts with length_cm, width_cm, height_cm, weight_kg (any can be null) and quantity.
    Returns {"vehicle": <rate card row>, "trips": n, "unmeasured": [item names without a full size/weight]}.
    An order that doesn't fit the largest vehicle is split into as many trips of it as the weight or volume needs.
    """
    measured = [i for i in items if all(i.get(k) for k in ("length_cm", "width_cm", "height_cm", "weight_kg"))]
    unmeasured = [i.get("item_name") or i.get("prod_var_name") or "item" for i in items if i not in measured]
    total_kg = sum(float(i["weight_kg"]) * i["quantity"] for i in measured)
    total_m3 = sum(volume_m3(i) * i["quantity"] for i in measured)
    start = UNMEASURED_MIN_VEHICLE if unmeasured else 0

    for v in vehicles[start:]:
        if total_kg <= v["max_kg"] and total_m3 <= volume_m3(v) and all(item_fits(i, v) for i in measured):
            return {"vehicle": v, "trips": 1, "unmeasured": unmeasured}

    largest = vehicles[-1]
    trips = max(1, math.ceil(total_kg / largest["max_kg"]), math.ceil(total_m3 / volume_m3(largest)))
    return {"vehicle": largest, "trips": trips, "unmeasured": unmeasured}


def trip_fee(vehicle: dict, km: float) -> float:
    """base fare + per km, with the cheaper rate after tier_km and the km already covered by the base fare taken off"""
    billable = max(0.0, km - float(vehicle.get("included_km") or 0))
    tier = vehicle.get("tier_km")
    if tier and vehicle.get("per_km_after") is not None:
        fee = vehicle["base"] + vehicle["per_km"] * min(billable, tier) + vehicle["per_km_after"] * max(0.0, billable - tier)
    else:
        fee = vehicle["base"] + vehicle["per_km"] * billable
    return float(math.ceil(fee))


# ---------- distance ----------

def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


@lru_cache(maxsize=512)
def geocode(address: str) -> tuple[float, float] | None:
    """lat/lng of an address from OpenStreetMap. Like the tracking map: if the full address isn't found,
    the street is dropped and it tries again with the rest, then with just the city."""
    parts = [p.strip() for p in address.split(",") if p.strip()]
    tries = [parts, parts[1:], parts[1:2]]
    seen: set[str] = set()
    for t in tries:
        q = ", ".join(t)
        if not q or q in seen:
            continue
        seen.add(q)
        try:
            res = httpx.get(
                "https://nominatim.openstreetmap.org/search",
                params={"format": "json", "limit": 1, "countrycodes": "ph", "q": q},
                headers={"User-Agent": USER_AGENT},
                timeout=TIMEOUT,
            )
            hits = res.json() if res.status_code == 200 else []
        except (httpx.HTTPError, ValueError):
            hits = []
        if hits:
            return float(hits[0]["lat"]), float(hits[0]["lon"])
    return None


@lru_cache(maxsize=512)
def road_km(origin: tuple[float, float], dest: tuple[float, float]) -> tuple[float, bool]:
    """(km by road, True) from OSRM, or (straight line x 1.3, False) when the route server is down"""
    try:
        res = httpx.get(
            f"https://router.project-osrm.org/route/v1/driving/{origin[1]},{origin[0]};{dest[1]},{dest[0]}",
            params={"overview": "false"},
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )
        routes = res.json().get("routes") if res.status_code == 200 else None
        if routes:
            return round(routes[0]["distance"] / 1000, 1), True
    except (httpx.HTTPError, ValueError, KeyError):
        pass
    return round(haversine_km(origin, dest) * 1.3, 1), False


# ---------- the quote ----------

def locate(settings: dict, lat: float | None, lng: float | None, address: str) -> dict:
    """where the order goes: the customer's pin if they dropped one, otherwise the typed address on the map"""
    if lat is not None and lng is not None:
        return {"lat": lat, "lng": lng, "located_by": "pin"}
    point = geocode(address)
    if not point:
        raise HTTPException(400, "We couldn't find your address on the map. Please pin your location in your shipping details.")
    return {"lat": point[0], "lng": point[1], "located_by": "address"}


def quote(settings: dict, items: list[dict], lat: float | None, lng: float | None, address: str) -> dict:
    """Everything the checkout shows and the order saves: vehicle, trips, distance, fee and the drop-off point."""
    vehicles = settings["vehicles"]
    if not vehicles:
        raise HTTPException(503, "Delivery rates are not set up yet, please choose store pickup")
    drop = locate(settings, lat, lng, address)
    km, by_road = road_km((settings["store_lat"], settings["store_lng"]), (drop["lat"], drop["lng"]))
    max_km = float(settings.get("max_km") or 0)
    if max_km and km > max_km:
        raise HTTPException(400, f"Sorry, we only deliver within {max_km:g} km of the store ({km:g} km away). Store pickup is still available.")

    picked = pick_vehicle(items, vehicles)
    return {
        "courier": "Lalamove",
        "vehicle": picked["vehicle"]["name"],
        "trips": picked["trips"],
        "distance_km": km,
        "by_road": by_road,
        "delivery_fee": trip_fee(picked["vehicle"], km) * picked["trips"],
        "drop_lat": drop["lat"],
        "drop_lng": drop["lng"],
        "located_by": drop["located_by"],
        "unmeasured": picked["unmeasured"],
    }


def new_token() -> str:
    # goes in the receipt's QR code; long enough that it can't be guessed
    return secrets.token_urlsafe(24)
