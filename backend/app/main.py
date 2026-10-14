from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import DATABASE_URL, FRONTEND_URLS
from .db import pool
from .routers import admin, auth, cart, catalog, orders, reviews, users, wishlist


@asynccontextmanager
async def lifespan(app: FastAPI):
    if DATABASE_URL:
        pool.open()
    else:
        print("WARNING: DATABASE_URL is missing in backend/.env, database requests will fail until it's set.")
    yield
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

for r in (auth, catalog, cart, wishlist, orders, users, admin, reviews):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}
