"""FastAPI dependencies: bearer token -> Claims -> the current User, by role."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwks import AuthError, Claims, TokenVerifier, default_verifier
from app.db import get_session
from app.models import Role, User
from app.services import users
from app.settings import settings

DEV_PREFIX = "dev:"

# auto_error=False: a missing header must give our 401, not FastAPI's 403.
_bearer = HTTPBearer(auto_error=False, description="Cognito access token")


def get_verifier() -> TokenVerifier:
    return default_verifier()


def dev_auth_enabled() -> bool:
    return settings.dev_auth


def require_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: TokenVerifier = Depends(get_verifier),
    dev_auth: bool = Depends(dev_auth_enabled),
) -> Claims:
    try:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise AuthError("expected 'Authorization: Bearer <token>'")
        token = credentials.credentials
        if dev_auth and token.startswith(DEV_PREFIX):
            # Local demo login: the "token" is just the Cognito sub to act as.
            sub = token.removeprefix(DEV_PREFIX)
            if not sub:
                raise AuthError("empty dev sub")
            return Claims(sub=sub)
        return verifier.verify(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    claims: Claims = Depends(require_claims),
    session: Session = Depends(get_session),
) -> User:
    """Any signed-in person; the row is created (without a role) on first use."""
    return users.get_or_create(session, claims.sub, claims.email, claims.name)


def _forbidden() -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")


def get_current_tutor(user: User = Depends(get_current_user)) -> User:
    """Tutor endpoints depend on this; tests override it to act as a tutor."""
    if user.role != Role.tutor:
        raise _forbidden()
    return user


def get_current_member(user: User = Depends(get_current_user)) -> User:
    """A student or a parent: the portal endpoints depend on this."""
    if user.role not in (Role.student, Role.parent):
        raise _forbidden()
    return user
