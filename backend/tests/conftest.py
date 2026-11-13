"""Shared fixtures.

Test settings are set before anything from `app` is imported. Database tests run
against a real PostgreSQL from TEST_DATABASE_URL: the schema is rebuilt with the
Alembic migrations once per session, and every test runs in a transaction that is
rolled back, so tests never see each other's rows.
"""

import os

os.environ.setdefault("COGNITO_AUTHORITY", "https://cognito.test/us-east-1_TEST")
os.environ.setdefault("COGNITO_CLIENT_ID", "test-client")

from collections.abc import Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Connection, Engine, create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.auth.dependencies import get_current_tutor  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": target.database},
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set")
    _ensure_database(TEST_DATABASE_URL)
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
        config.attributes["connection"] = conn
        command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def connection(engine: Engine) -> Iterator[Connection]:
    with engine.connect() as conn:
        transaction = conn.begin()
        yield conn
        transaction.rollback()


@pytest.fixture
def db(connection: Connection) -> Iterator[Session]:
    # Commits inside the code under test only release a savepoint; the outer
    # transaction is rolled back by the `connection` fixture.
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )
    yield session
    session.close()


@pytest.fixture
def db_client(db: Session, client: TestClient) -> TestClient:
    """A client whose requests share the test's rolled-back transaction."""
    app.dependency_overrides[get_session] = lambda: db
    return client


def _make_tutor(db: Session, sub: str) -> User:
    tutor = User(cognito_sub=sub, email=f"{sub}@example.com", role="tutor")
    db.add(tutor)
    db.flush()
    return tutor


@pytest.fixture
def tutor_a(db: Session):
    return _make_tutor(db, "tutor-a")


@pytest.fixture
def tutor_b(db: Session):
    return _make_tutor(db, "tutor-b")


@pytest.fixture
def as_tutor(db_client: TestClient):
    """as_tutor(tutor) -> the client, with get_current_tutor returning that tutor.

    Switching tutors on the same client is how the isolation tests act as two
    different people.
    """

    def switch(tutor) -> TestClient:
        app.dependency_overrides[get_current_tutor] = lambda: tutor
        return db_client

    return switch
