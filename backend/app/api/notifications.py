"""Telegram webhook (the bot's incoming messages) and the reminder scheduler hook.

- POST /api/telegram/webhook: Telegram calls it; checked by the secret it echoes.
- POST /api/internal/reminders/run: the scheduler (GitHub Actions, every ~10 min).
- POST /api/internal/telegram/webhook: points the bot at this server, once.

Both internal endpoints need X-Cron-Token == CRON_TOKEN and answer 404 without it.
"""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.common import ResponseModel
from app.services import reminders, telegram
from app.settings import settings

webhook_router = APIRouter(prefix="/telegram", tags=["telegram"])
internal_router = APIRouter(prefix="/internal", tags=["internal (scheduler)"])


def get_cron_token() -> str:
    return settings.cron_token


def require_cron(
    x_cron_token: str | None = Header(None),
    expected: str = Depends(get_cron_token),
) -> None:
    if not expected:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    if not x_cron_token or not hmac.compare_digest(x_cron_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid cron token")


def get_webhook_secret() -> str:
    return telegram.webhook_secret() if settings.telegram_webhook_secret else ""


@webhook_router.post("/webhook", include_in_schema=False)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
    expected: str = Depends(get_webhook_secret),
    session: Session = Depends(get_session),
) -> dict:
    if not expected or not telegram.enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token, expected
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid secret")
    telegram.handle_update(session, await request.json())
    return {"ok": True}


class ReminderRunOut(ResponseModel):
    sent: int
    skipped: int
    errors: int
    by_kind: dict[str, int]


@internal_router.post(
    "/reminders/run",
    response_model=ReminderRunOut,
    dependencies=[Depends(require_cron)],
)
def run_reminders(session: Session = Depends(get_session)) -> ReminderRunOut:
    """Send the reminders that are due; safe to call any number of times."""
    if not telegram.enabled():
        return ReminderRunOut(sent=0, skipped=0, errors=0, by_kind={})
    result = reminders.run(session)
    return ReminderRunOut(
        sent=result.sent,
        skipped=result.skipped,
        errors=result.errors,
        by_kind=result.by_kind,
    )


@internal_router.post("/telegram/webhook", dependencies=[Depends(require_cron)])
def setup_webhook() -> dict:
    """Tell Telegram to deliver the bot's messages to PUBLIC_API_URL."""
    if not telegram.enabled() or not settings.telegram_webhook_secret:
        raise HTTPException(status.HTTP_409_CONFLICT, "telegram_disabled")
    try:
        return telegram.set_webhook(f"{settings.public_api_url}/api/telegram/webhook")
    except telegram.TelegramError as error:
        # E.g. 401 "Unauthorized" for a wrong TELEGRAM_BOT_TOKEN: say so.
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"telegram: {error.status} {error.description}".strip(),
        ) from None
