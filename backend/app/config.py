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

# the inbox Contact Us messages are sent to. Without it they go to the store's support email (Settings > Store Info).
CONTACT_EMAIL_TO = os.getenv("CONTACT_EMAIL_TO", "")

# the account that sends email (Contact Us messages and receipts). See app/mailer.py for the Gmail setup.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "").replace(" ", "")  # Google shows app passwords with spaces
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Comfy&Co")
LOW_STOCK_LIMIT = 5
DELETE_AFTER_DAYS = 30  # a deactivated account is deleted this many days later
REFUND_DAYS = 3  # a refund can be requested up to this many days after the order was delivered
COURIER = "Lalamove"  # every delivery is one Lalamove booking, store pickup is free
MAX_DELIVERY_ATTEMPTS = 3  # after this many failed hand-overs the order is Returned to the store
FAILED_ATTEMPT_REASONS = ["Customer not home", "Customer unreachable", "Wrong or incomplete address", "Customer refused the package", "Other"]
TIMEZONE = "Asia/Manila"

# Lalamove Metro Manila vehicles, smallest first. Sizes are the cargo space (cm) and weight limit from lalamove.com/en-ph,
# the fares are the Metro Manila rate card: base fare + per km, some with a cheaper rate after `tier_km`,
# the 3,000 kg truck's base fare already covers the first 40 km (`included_km`). A Super Admin can change them in Settings > Delivery.
LALAMOVE_VEHICLES = [
    {"name": "Motorcycle", "length_cm": 50, "width_cm": 40, "height_cm": 50, "max_kg": 20, "base": 49, "per_km": 6, "tier_km": 5, "per_km_after": 5, "included_km": 0},
    {"name": "Sedan 200 kg", "length_cm": 100, "width_cm": 60, "height_cm": 70, "max_kg": 200, "base": 100, "per_km": 18, "tier_km": 5, "per_km_after": 15, "included_km": 0},
    {"name": "MPV 300 kg", "length_cm": 120, "width_cm": 100, "height_cm": 90, "max_kg": 300, "base": 115, "per_km": 20, "tier_km": None, "per_km_after": None, "included_km": 0},
    {"name": "MPV 600 kg", "length_cm": 210, "width_cm": 120, "height_cm": 110, "max_kg": 600, "base": 220, "per_km": 22, "tier_km": None, "per_km_after": None, "included_km": 0},
    {"name": "Small Truck 1,000 kg", "length_cm": 210, "width_cm": 120, "height_cm": 120, "max_kg": 1000, "base": 310, "per_km": 22, "tier_km": None, "per_km_after": None, "included_km": 0},
    {"name": "Medium Truck 2,000 kg", "length_cm": 300, "width_cm": 170, "height_cm": 170, "max_kg": 2000, "base": 1290, "per_km": 35, "tier_km": None, "per_km_after": None, "included_km": 0},
    {"name": "Large Truck 3,000 kg", "length_cm": 430, "width_cm": 180, "height_cm": 210, "max_kg": 3000, "base": 2000, "per_km": 40, "tier_km": None, "per_km_after": None, "included_km": 40},
    {"name": "Large Truck 12,000 kg", "length_cm": 1000, "width_cm": 240, "height_cm": 230, "max_kg": 12000, "base": 7200, "per_km": 85, "tier_km": None, "per_km_after": None, "included_km": 0},
]

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
        "return_policy": "3-Day Return & Refund Window",  # display only, REFUND_DAYS is what the API enforces
        "refund_method": "Original Payment Method",
        "free_shipping_threshold": 0,
    },
    "regional": {"currency": "PHP", "vat_percent": 12, "timezone": TIMEZONE},
    # where deliveries start (the store in Intramuros), the vehicle rate card, and how far Lalamove will go (0 = no limit)
    "delivery": {"store_lat": 14.58689, "store_lng": 120.97636, "max_km": 0, "vehicles": LALAMOVE_VEHICLES},
    "security": {"require_2fa": False, "inactivity_minutes": 30, "sessions_valid_after": None},
}
