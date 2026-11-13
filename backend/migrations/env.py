"""Alembic environment: the URL comes from DATABASE_URL, metadata from app.models."""

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.db import Base
from app.settings import settings

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    # Tests pass their own URL through the config; everything else uses the env.
    url = config.get_main_option("sqlalchemy.url") or settings.database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def run_migrations_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection")
    if connectable is None:
        engine = engine_from_config(
            {"sqlalchemy.url": _url()}, prefix="sqlalchemy.", poolclass=pool.NullPool
        )
        with engine.connect() as connection:
            _run(connection)
    else:
        _run(connectable)


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
