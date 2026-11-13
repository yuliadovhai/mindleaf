"""Database engine and the request-scoped session dependency."""

import os
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.settings import settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set")
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        # One Lambda instance handles one request at a time: one connection.
        return create_engine(
            settings.database_url, pool_pre_ping=True, pool_size=1, max_overflow=0
        )
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()
