"""The full auth chain: bearer header -> JWT checks -> tutor row."""

import pytest
from sqlalchemy import func, select

from app.auth.dependencies import get_verifier
from app.auth.jwks import AuthError, StaticKeys, TokenVerifier
from app.main import app
from app.models import User
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


def test_me_creates_user_once_without_role(auth_client, db):
    token = make_token("new-user", email="t@example.com")

    first = auth_client.get("/api/me", headers=bearer(token))
    second = auth_client.get("/api/me", headers=bearer(token))

    assert first.status_code == 200
    assert first.json()["email"] == "t@example.com"
    assert first.json()["role"] is None
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["created_at"].endswith(("+02:00", "+03:00"))
    count = db.scalar(
        select(func.count()).select_from(User).where(User.cognito_sub == "new-user")
    )
    assert count == 1


def test_user_without_role_cannot_use_tutor_or_portal_endpoints(auth_client):
    headers = bearer(make_token("no-role"))

    assert auth_client.get("/api/students", headers=headers).status_code == 403
    assert auth_client.get("/api/dashboard", headers=headers).status_code == 403
    assert auth_client.get("/api/students", headers=headers).json() == {
        "detail": "forbidden"
    }


def test_choosing_tutor_role_opens_tutor_endpoints(auth_client):
    headers = bearer(make_token("future-tutor"))

    response = auth_client.post("/api/me/role", json={"role": "tutor"}, headers=headers)

    assert response.status_code == 200
    assert response.json()["role"] == "tutor"
    assert auth_client.get("/api/students", headers=headers).status_code == 200
    # Choosing again is harmless.
    again = auth_client.post("/api/me/role", json={"role": "tutor"}, headers=headers)
    assert again.status_code == 200


@pytest.mark.parametrize("role", ["student", "parent", "admin"])
def test_only_tutor_role_can_be_self_assigned(auth_client, role):
    response = auth_client.post(
        "/api/me/role", json={"role": role}, headers=bearer(make_token("x"))
    )

    assert response.status_code == 422


def test_role_cannot_change_once_set(auth_client, db):
    db.add(User(cognito_sub="a-parent", role="parent"))
    db.flush()

    response = auth_client.post(
        "/api/me/role", json={"role": "tutor"}, headers=bearer(make_token("a-parent"))
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "role_already_set"}


def test_patch_me(auth_client, db):
    db.add(User(cognito_sub="t1", role="tutor"))
    db.add(User(cognito_sub="p1", role="parent"))
    db.flush()

    tutor = auth_client.patch(
        "/api/me",
        json={"name": "Оксана", "cancel_notice_hours": 12},
        headers=bearer(make_token("t1")),
    )
    assert tutor.status_code == 200
    assert tutor.json()["name"] == "Оксана"
    assert tutor.json()["cancel_notice_hours"] == 12

    parent = auth_client.patch(
        "/api/me", json={"cancel_notice_hours": 1}, headers=bearer(make_token("p1"))
    )
    assert parent.status_code == 409
    assert parent.json() == {"detail": "tutor_only_setting"}
