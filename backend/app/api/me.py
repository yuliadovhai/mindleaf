from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_session
from app.models import User
from app.schemas.common import ErrorResponse
from app.schemas.user import RoleChoice, TelegramLinkOut, UserOut, UserUpdate
from app.services import telegram, users

router = APIRouter(tags=["me"])


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)) -> UserOut:
    """The signed-in user; created without a role on the first call."""
    return UserOut.of(user)


@router.patch(
    "/me",
    response_model=UserOut,
    responses={409: {"model": ErrorResponse, "description": "tutor_only_setting"}},
)
def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserOut:
    fields = {
        k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None
    }
    return UserOut.of(users.update_profile(session, user, fields=fields))


@router.post(
    "/me/role",
    response_model=UserOut,
    responses={409: {"model": ErrorResponse, "description": "role_already_set"}},
)
def choose_role(
    body: RoleChoice,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserOut:
    """Become a tutor. Students and parents get their role from an invite code."""
    return UserOut.of(users.become_tutor(session, user))


@router.post(
    "/me/telegram",
    response_model=TelegramLinkOut,
    responses={409: {"model": ErrorResponse, "description": "telegram_disabled"}},
)
def link_telegram(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TelegramLinkOut:
    """A link that opens the bot; pressing Start there connects this account."""
    return TelegramLinkOut(url=telegram.link_url(session, user))


@router.delete("/me/telegram", status_code=status.HTTP_204_NO_CONTENT)
def unlink_telegram(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Stop Telegram reminders for this account."""
    telegram.disconnect(session, user)
