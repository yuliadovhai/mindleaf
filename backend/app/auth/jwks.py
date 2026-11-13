"""Where the Cognito signing keys come from, and the access-token check.

In Lambda the function has no internet access (VPC without NAT), so the JWKS
document is passed in COGNITO_JWKS at deploy time and never fetched. Locally
COGNITO_JWKS is unset and the keys are downloaded from the pool and cached;
PyJWKClient re-downloads once when it meets an unknown `kid`.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import jwt

from app.settings import settings


class AuthError(Exception):
    pass


@dataclass(frozen=True)
class Claims:
    sub: str
    email: str | None = None
    name: str | None = None


class KeySource(Protocol):
    def key_for(self, token: str) -> jwt.PyJWK: ...


class StaticKeys:
    """Keys from a JWKS JSON document; an empty set rejects every token."""

    def __init__(self, jwks_json: str) -> None:
        document = json.loads(jwks_json)  # invalid JSON fails at start-up
        self._keys = {
            key["kid"]: jwt.PyJWK(key, algorithm="RS256")
            for key in document.get("keys", [])
        }

    def key_for(self, token: str) -> jwt.PyJWK:
        kid = jwt.get_unverified_header(token).get("kid")
        try:
            return self._keys[kid]
        except KeyError:
            raise AuthError("unknown signing key") from None


class RemoteKeys:
    """Keys downloaded from the pool's jwks.json and cached in the process."""

    def __init__(self, url: str) -> None:
        self._client = jwt.PyJWKClient(url, cache_keys=True)

    def key_for(self, token: str) -> jwt.PyJWK:
        return self._client.get_signing_key_from_jwt(token)


class TokenVerifier:
    def __init__(self, authority: str, client_id: str, keys: KeySource) -> None:
        self.authority = authority.rstrip("/")
        self.client_id = client_id
        self.keys = keys

    def verify(self, token: str) -> Claims:
        """Accept only a Cognito access token issued for our app client."""
        try:
            payload = jwt.decode(
                token,
                self.keys.key_for(token),
                algorithms=["RS256"],
                issuer=self.authority,
                options={
                    "require": ["exp", "iss", "sub", "token_use", "client_id"],
                    # Access tokens carry no `aud`; client_id is checked below.
                    "verify_aud": False,
                },
            )
        except jwt.PyJWTError as exc:
            raise AuthError(str(exc)) from exc

        if payload["token_use"] != "access":
            raise AuthError("expected an access token")
        if not self.client_id or payload["client_id"] != self.client_id:
            raise AuthError("token was issued for another client")
        return Claims(
            sub=payload["sub"], email=payload.get("email"), name=payload.get("name")
        )


# Parsed at import, so a malformed COGNITO_JWKS stops the app from starting.
_STATIC_KEYS = StaticKeys(settings.cognito_jwks) if settings.cognito_jwks else None


@lru_cache(maxsize=1)
def default_verifier() -> TokenVerifier:
    keys: KeySource = _STATIC_KEYS or RemoteKeys(
        f"{settings.cognito_authority}/.well-known/jwks.json"
    )
    return TokenVerifier(settings.cognito_authority, settings.cognito_client_id, keys)
