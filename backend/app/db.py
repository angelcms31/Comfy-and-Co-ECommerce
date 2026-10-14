from typing import Annotated

from fastapi import Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.numeric import FloatLoader
from psycopg_pool import ConnectionPool

from .config import DATABASE_URL


def _configure(conn):
    # prices come back as float instead of Decimal
    conn.adapters.register_loader("numeric", FloatLoader)


# prepare_threshold=None because the Supabase pooler doesn't support prepared statements
pool = ConnectionPool(
    DATABASE_URL,
    min_size=1,
    max_size=10,
    open=False,
    configure=_configure,
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
)


def get_db():
    if pool.closed:
        raise HTTPException(503, "Database is not set up yet. Add DATABASE_URL to backend/.env")
    # commits when the request finishes, rolls back if it raised an error
    with pool.connection() as conn:
        yield conn


# commit before the response is sent, so the frontend never gets "ok" for something that didn't save
Db = Annotated[Connection, Depends(get_db, scope="function")]
