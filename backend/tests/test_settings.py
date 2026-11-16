import pytest

from app.settings import _sqlalchemy_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("", ""),
    ],
)
def test_database_url_gets_the_psycopg_driver(given, expected):
    assert _sqlalchemy_url(given) == expected
