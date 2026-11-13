"""The full auth chain: bearer header -> JWT checks -> tutor row."""

import pytest
from sqlalchemy import func, select

from app.auth.dependencies import get_verifier
from app.auth.jwks import AuthError, StaticKeys, TokenVerifier
from app.main import app
from app.models import Tutor
from tests.tokens import AUTHORITY, CLIENT_ID, make_token, verifier


@pytest.fixture
def auth_client(db_client):
    app.dependency_overrides[get_verifier] = verifier
    return db_client


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_valid_token_returns_claims():
    claims = verifier().verify(make_token("abc", email="t@example.com"))

    assert claims.sub == "abc"
    assert claims.email == "t@example.com"


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(make_token(expires_in=-10), id="expired"),
        pytest.param(make_token(iss="https://evil.test/pool"), id="wrong-issuer"),
        pytest.param(make_token(client_id="another-client"), id="wrong-client"),
        pytest.param(make_token(token_use="id"), id="id-token"),
        pytest.param(make_token(client_id=None), id="no-client-id"),
        pytest.param(make_token(signed_by_other_key=True), id="bad-signature"),
        pytest.param(make_token(kid="rotated-away"), id="unknown-kid"),
        pytest.param("not-a-jwt", id="garbage"),
    ],
)
def test_invalid_tokens_are_rejected(token):
    with pytest.raises(AuthError):
        verifier().verify(token)


def test_empty_jwks_rejects_everything():
    empty = TokenVerifier(AUTHORITY, CLIENT_ID, StaticKeys('{"keys": []}'))

    with pytest.raises(AuthError):
        empty.verify(make_token())


def test_missing_header_is_401(auth_client):
    response = auth_client.get("/api/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid or missing token"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_wrong_scheme_is_401(auth_client):
    response = auth_client.get(
        "/api/me", headers={"Authorization": f"Basic {make_token()}"}
    )

    assert response.status_code == 401


def test_invalid_token_is_401(auth_client):
    response = auth_client.get("/api/me", headers=bearer(make_token(expires_in=-10)))

    assert response.status_code == 401


def test_me_creates_tutor_once(auth_client, db):
    token = make_token("new-tutor", email="t@example.com")

    first = auth_client.get("/api/me", headers=bearer(token))
    second = auth_client.get("/api/me", headers=bearer(token))

    assert first.status_code == 200
    assert first.json()["email"] == "t@example.com"
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["created_at"].endswith(("+02:00", "+03:00"))
    count = db.scalar(
        select(func.count()).select_from(Tutor).where(Tutor.cognito_sub == "new-tutor")
    )
    assert count == 1
