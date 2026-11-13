"""FastAPI dependencies: bearer token -> Claims -> the current Tutor row."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwks import AuthError, Claims, TokenVerifier, default_verifier
from app.db import get_session
from app.models import Tutor
from app.services import tutors

# auto_error=False: a missing header must give our 401, not FastAPI's 403.
_bearer = HTTPBearer(auto_error=False, description="Cognito access token")


def get_verifier() -> TokenVerifier:
    return default_verifier()


def require_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: TokenVerifier = Depends(get_verifier),
) -> Claims:
    try:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise AuthError("expected 'Authorization: Bearer <token>'")
        return verifier.verify(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_tutor(
    claims: Claims = Depends(require_claims),
    session: Session = Depends(get_session),
) -> Tutor:
    """Every endpoint except /api/health depends on this; tests override it."""
    return tutors.get_or_create(session, claims.sub, claims.email, claims.name)
