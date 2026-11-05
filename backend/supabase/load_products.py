"""
Adds the products in products.json to Supabase, with their photos.

    python backend/supabase/load_products.py "<images folder>"            compress, upload and insert
    python backend/supabase/load_products.py "<images folder>" --dry-run  only compress, saves to --out to check the sizes

Photos are matched to products by file name (e.g. "Compact Steel Slipper Rack - 1.png" or
"01_Metal Platform Single Bed_1.png"). A color at the end, like "..._1(Blue).png", puts the photo
on that color's variant only. Photos are shrunk to 1000px WebP and uploaded to the IMAGE_BUCKET bucket.
Products that already exist (same product_name) are skipped, so it's safe to run again.
Needs backend/.env with SUPABASE_URL, SUPABASE_SERVICE_KEY and DATABASE_URL.
"""

import argparse
import io
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")

MAX_SIZE = 1000
QUALITY = 80
SKU_PREFIX = {"Living Room": "LIV", "Kitchen Dining": "KIT", "Room Storage": "STO", "Bedroom": "BED", "Home Office": "OFF"}


def norm(text: str) -> str:
    # "Extendable & Stackable" and "Extendable and Stackable" should match
    return re.sub(r"[^a-z0-9]", "", text.lower().replace("&", "and"))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", "and")).strip("-")


def color_code(color: str) -> str:
    # same style as seed.sql: "Moss Green" -> MOSGRE
    return "".join(w[:3] for w in re.findall(r"[A-Za-z]+", color)).upper()


def find_photos(folder: Path, name: str) -> list[Path]:
    key = norm(name)
    found = []
    for f in folder.rglob("*"):
        if f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        # leading "01_" is just the sheet's numbering
        stem = norm(re.sub(r"^\d+_", "", f.stem))
        if stem.startswith(key):
            # number right after the name decides the order, no number goes first
            num = re.match(r"\d+", stem[len(key):])
            found.append((int(num.group()) if num else 0, f.name, f))
    return [f for _, _, f in sorted(found)]


def photo_color(path: Path) -> str | None:
    # "Blanket_1(Blue).png" -> "blue"
    m = re.search(r"\(([^()]+)\)$", path.stem.strip())
    return m.group(1).strip().lower() if m else None


def compress(path: Path) -> bytes:
    im = Image.open(path)
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    im.thumbnail((MAX_SIZE, MAX_SIZE))
    out = io.BytesIO()
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return out.getvalue()


def description(p: dict) -> str:
    if p.get("sizes"):
        specs = ["Sizes: " + ", ".join(f"{n} {v['size']}" for n, v in p["sizes"].items()), f"Color: {', '.join(p['colors'])}"]
    elif p.get("size"):
        specs = [f"Size: {p['size']}"]
    else:
        specs = []
    if p.get("weight"):
        specs.append(f"Weight: {p['weight']}")
    if p.get("material"):
        specs.append(f"Material: {p['material']}")
    return f"{p['description']} {'. '.join(specs)}." if specs else p["description"]


def variants(p: dict) -> list[tuple[str, int]]:
    # one variant per size if the product has sizes, otherwise one per color
    if p.get("sizes"):
        return [(n, v["price"]) for n, v in p["sizes"].items()]
    return [(c, p["price"]) for c in p["colors"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images", type=Path, help="folder with the product photos")
    parser.add_argument("--dry-run", action="store_true", help="only compress the photos, don't upload or insert")
    parser.add_argument("--out", type=Path, default=HERE / "compressed", help="where --dry-run saves the photos")
    parser.add_argument("--stock", type=int, default=10, help="starting stock for every variant")
    args = parser.parse_args()

    products = json.loads((HERE / "products.json").read_text(encoding="utf-8"))

    if not args.dry_run:
        import psycopg
        from supabase import create_client

        bucket_name = os.getenv("IMAGE_BUCKET", "products")
        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        if bucket_name not in [b.name for b in client.storage.list_buckets()]:
            client.storage.create_bucket(bucket_name, options={"public": True})
            print(f"Created public bucket '{bucket_name}'")
        bucket = client.storage.from_(bucket_name)
        conn = psycopg.connect(os.environ["DATABASE_URL"], prepare_threshold=None)

    total_before = total_after = 0
    added = skipped = 0
    for i, p in enumerate(products, start=1):
        if not args.dry_run and conn.execute("select 1 from product where product_name = %s", (p["name"],)).fetchone():
            print(f"skip (already there)  {p['name']}")
            skipped += 1
            continue

        urls = []
        photos = find_photos(args.images, p["name"])
        for n, photo in enumerate(photos, start=1):
            data = compress(photo)
            total_before += photo.stat().st_size
            total_after += len(data)
            path = f"catalog/{slug(p['name'])}-{n}.webp"
            if args.dry_run:
                (args.out / path).parent.mkdir(parents=True, exist_ok=True)
                (args.out / path).write_bytes(data)
            else:
                bucket.upload(path, data, {"content-type": "image/webp", "upsert": "true"})
                urls.append((bucket.get_public_url(path).rstrip("?"), photo_color(photo)))
            print(f"  {photo.stat().st_size / 1024 / 1024:6.1f} MB -> {len(data) / 1024:5.0f} KB  {photo.name}")

        if args.dry_run:
            print(f"{len(photos)} photo(s)  {p['name']}")
            continue

        conn.execute("insert into item_categ (item_category) values (%s) on conflict (item_category) do nothing", (p["category"],))
        categ_id = conn.execute("select item_categ_id from item_categ where item_category = %s", (p["category"],)).fetchone()[0]
        product_id = conn.execute(
            "insert into product (item_categ_id, product_name, prod_desc) values (%s, %s, %s) returning product_id",
            (categ_id, p["name"], description(p)),
        ).fetchone()[0]
        for color, price in variants(p):
            images = [u for u, c in urls if c in (None, color.lower())]
            sku = f"{SKU_PREFIX.get(p['category'], 'PRD')}-{i:03d}-{color_code(color)}"
            conn.execute(
                "insert into prod_var (product_id, sku, prod_var_name, prod_attr, b_price, stocks, images)"
                " values (%s, %s, %s, %s, %s, %s, %s)",
                (product_id, sku, f"{p['name']} - {color}", color, price, args.stock, ",".join(images) or None),
            )
        print(f"added, {len(photos)} photo(s)  {p['name']}")
        added += 1

    if not args.dry_run:
        conn.commit()
        conn.close()
        print(f"\nDone: {added} added, {skipped} skipped")
    if total_before:
        print(f"Photos: {total_before / 1024 / 1024:.0f} MB -> {total_after / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
