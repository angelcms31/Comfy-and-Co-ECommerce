from functools import lru_cache

from supabase import Client, create_client

from .config import SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL


@lru_cache
def admin_client() -> Client:
    # service role: can create users and upload files, never send this key to the frontend
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def public_client() -> Client:
    # new client each time so one user's sign in doesn't stick to the next request
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
