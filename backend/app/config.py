import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# comma separated, e.g. http://localhost:5173,https://comfyco.vercel.app
FRONTEND_URLS = [u.strip() for u in os.getenv("FRONTEND_URLS", "http://localhost:5173").split(",") if u.strip()]

IMAGE_BUCKET = os.getenv("IMAGE_BUCKET", "products")

# the inbox Contact Us messages are addressed to. Without it they go to the store's support email.
CONTACT_EMAIL_TO = os.getenv("CONTACT_EMAIL_TO", "")
LOW_STOCK_LIMIT = 5
DELETE_AFTER_DAYS = 30  # a deactivated account is deleted this many days later
DELIVERY_FEE = 100  # standard delivery, store pickup is free
COURIERS = ["J&T Express", "LBC", "Flash Express", "Ninja Van"]
TIMEZONE = "Asia/Manila"

# Settings page (store_setting table): used until a Super Admin saves their own values
SETTING_DEFAULTS = {
    "store": {
        "name": "comfy&co",
        "support_email": "comfyandco@gmail.com",
        "phone": "+63 912 345 6789",
        "address": "General Luna cor. Muralla St, Intramuros, Manila, 1002 Metro Manila",
        "hours": "Mon–Sat, 9AM–6PM",
    },
    "policies": {
        "cancellation_window": "Before the order ships",
        "return_policy": "7-Day Return & Refund Window",
        "refund_method": "Original Payment Method",
        "free_shipping_threshold": 0,
    },
    "regional": {"currency": "PHP", "vat_percent": 12, "timezone": TIMEZONE},
    "security": {"require_2fa": False, "inactivity_minutes": 30, "sessions_valid_after": None},
}
