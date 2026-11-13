from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas.common import ErrorResponse
from app.schemas.user import RoleChoice, UserOut, UserUpdate
from app.services import users

router = APIRouter(tags=["me"])


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)) -> User:
    """The signed-in user; created without a role on the first call."""
    return user


@router.patch(
    "/me",
    response_model=UserOut,
    responses={409: {"model": ErrorResponse, "description": "tutor_only_setting"}},
)
def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    fields = {
        k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None
    }
    return users.update_profile(session, user, fields=fields)


@router.post(
    "/me/role",
    response_model=UserOut,
    responses={409: {"model": ErrorResponse, "description": "role_already_set"}},
)
def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    """Become a tutor. Students and parents get their role from an invite code."""
    return users.become_tutor(session, user)
