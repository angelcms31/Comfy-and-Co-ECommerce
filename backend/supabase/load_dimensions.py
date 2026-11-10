"""Fills prod_var.length_cm / width_cm / height_cm / weight_kg from the size and weight in products.json,
so the checkout can pick the Lalamove vehicle (app/delivery.py). Safe to run again, it only overwrites from the sheet.

    python backend/supabase/load_dimensions.py            writes to the database in backend/.env
    python backend/supabase/load_dimensions.py --dry-run  only prints what it would save

How the sheet's text becomes a packed size:
  "W55 x D74 x H85cm"   -> width 55, length 74, height 85 (furniture is delivered as is)
  "W195 x D230cm"       -> sheets, duvets and comforters have no height: they're folded in four (W/4 x D/4) and 15 cm thick
  no size, "...100ML"   -> a small bottle, 12 x 6 x 6 cm
  "12kg (Single)"       -> 12 kg; one weight per product, used for every size
  no weight             -> 10 kg (the sheet has no weight for one hanger rack)
Anything the sheet doesn't cover stays null and can be typed in Inventory > Edit product.
"""

import argparse
import json
import re
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")

SIZE_3D = re.compile(r"W([\d.]+)\s*x\s*D([\d.]+)\s*x\s*H([\d.]+)\s*cm", re.I)
SIZE_2D = re.compile(r"W([\d.]+)\s*x\s*D([\d.]+)\s*cm", re.I)
WEIGHT = re.compile(r"([\d.]+)\s*kg", re.I)
FOLDED_HEIGHT = 15
BOTTLE = (12, 6, 6)
DEFAULT_KG = 10


def dims(size: str | None, name: str) -> tuple[float, float, float] | None:
    if size and (m := SIZE_3D.search(size)):
        w, d, h = map(float, m.groups())
        return d, w, h
    if size and (m := SIZE_2D.search(size)):
        w, d = map(float, m.groups())
        return round(d / 4, 1), round(w / 4, 1), FOLDED_HEIGHT
    if not size and re.search(r"\d+\s*ML\b", name, re.I):
        return BOTTLE
    return None


def kg(weight: str | None, name: str) -> float | None:
    if weight and (m := WEIGHT.search(weight)):
        return float(m.group(1))
    if re.search(r"\d+\s*ML\b", name, re.I):
        return 0.2
    return DEFAULT_KG


def rows_for(p: dict) -> list[tuple[str, tuple[float, float, float] | None, float | None]]:
    # (prod_attr, size, weight) for each variant, the same way load_products.py names them
    w = kg(p.get("weight"), p["name"])
    if p.get("sizes"):
        return [(attr, dims(v.get("size"), p["name"]), w) for attr, v in p["sizes"].items()]
    d = dims(p.get("size"), p["name"])
    return [(color, d, w) for color in p["colors"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    products = json.loads((HERE / "products.json").read_text(encoding="utf-8"))

    conn = None
    if not args.dry_run:
        import os

        import psycopg

        conn = psycopg.connect(os.environ["DATABASE_URL"], prepare_threshold=None)

    saved = missing = 0
    for p in products:
        for attr, size, weight in rows_for(p):
            if not size:
                missing += 1
                print(f"  no size: {p['name']} ({attr})")
                continue
            if args.dry_run:
                print(f"  {p['name']} ({attr}): {size[0]} x {size[1]} x {size[2]} cm, {weight} kg")
            else:
                cur = conn.execute(
                    """
                    update prod_var v set length_cm = %s, width_cm = %s, height_cm = %s, weight_kg = %s
                    from product p where p.product_id = v.product_id and p.product_name = %s and v.prod_attr = %s
                    """,
                    (*size, weight, p["name"], attr),
                )
                if cur.rowcount == 0:
                    print(f"  not in the database: {p['name']} ({attr})")
                    continue
            saved += 1
    if conn:
        conn.commit()
        conn.close()
    print(f"{saved} variants {'would be ' if args.dry_run else ''}updated, {missing} without a size")


if __name__ == "__main__":
    main()
