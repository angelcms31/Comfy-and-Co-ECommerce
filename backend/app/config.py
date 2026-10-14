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
LOW_STOCK_LIMIT = 5
TIMEZONE = "Asia/Manila"
