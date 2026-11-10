import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import cleanup
from .config import DATABASE_URL, FRONTEND_URLS
from .db import pool
from .routers import admin, admins, auth, cart, catalog, chat, contact, defects, orders, reviews, settings, users, wishlist


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_task = None
    if DATABASE_URL:
        pool.open()
        # deletes accounts deactivated over 30 days ago, now and every few hours
        cleanup_task = asyncio.create_task(cleanup.run_forever())
    else:
        print("WARNING: DATABASE_URL is missing in backend/.env, database requests will fail until it's set.")
    yield
    if cleanup_task:
        cleanup_task.cancel()
    if not pool.closed:
        pool.close()


app = FastAPI(title="Comfy&Co API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, catalog, cart, wishlist, orders, users, admin, admins, reviews, settings, contact, chat, defects):
    app.include_router(r.router, prefix="/api")
app.include_router(reviews.customer_router, prefix="/api")
app.include_router(chat.admin_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}
