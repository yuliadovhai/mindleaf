"""A test RSA key pair and a token factory for the auth tests."""

import json
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth.jwks import StaticKeys, TokenVerifier

AUTHORITY = "https://cognito.test/us-east-1_TEST"
CLIENT_ID = "test-client"
KID = "test-key"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(_private_key.public_key()))
JWKS = json.dumps({"keys": [{**_public_jwk, "kid": KID, "alg": "RS256", "use": "sig"}]})

_other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def verifier() -> TokenVerifier:
    return TokenVerifier(AUTHORITY, CLIENT_ID, StaticKeys(JWKS))


def make_token(
    sub: str = "tutor-a",
    *,
    expires_in: int = 3600,
    signed_by_other_key: bool = False,
    kid: str = KID,
    **overrides,
) -> str:
    now = int(time.time())
    claims = {
        "sub": sub,
        "iss": AUTHORITY,
        "client_id": CLIENT_ID,
        "token_use": "access",
        "iat": now,
        "exp": now + expires_in,
        **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    key = _other_key if signed_by_other_key else _private_key
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})
