"""Sending Telegram messages through the Bot API (no SDK: one HTTPS call).

Tests replace `send_message` (see tests/test_reminders.py), so nothing here runs
without a real bot token.
"""

import json
import logging
import secrets
import urllib.error
import urllib.request

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.services.errors import Conflict
from app.settings import settings

log = logging.getLogger(__name__)

API = "https://api.telegram.org"


class ChatGone(Exception):
    """The user blocked the bot or deleted the chat: stop writing there."""


def enabled() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_bot_username)


def _call(method: str, payload: dict) -> dict:
    request = urllib.request.Request(
        f"{API}/bot{settings.telegram_bot_token}/{method}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        if error.code == 403:
            raise ChatGone from error
        log.warning("telegram %s failed: %s %s", method, error.code, error.read()[:300])
        raise


def send_message(chat_id: int, text: str) -> None:
    """HTML text; raises ChatGone when the user blocked the bot."""
    _call(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "link_preview_options": {"is_disabled": True},
        },
    )


def set_webhook(url: str) -> dict:
    return _call(
        "setWebhook",
        {
            "url": url,
            "secret_token": settings.telegram_webhook_secret,
            "allowed_updates": ["message"],
        },
    )


def link_url(session: Session, user: User) -> str:
    """A t.me link that opens the bot with a fresh one-time token for this user."""
    if not enabled():
        raise Conflict("telegram_disabled")
    user.telegram_link_token = secrets.token_urlsafe(18)
    session.commit()
    return f"https://t.me/{settings.telegram_bot_username}?start={user.telegram_link_token}"


def disconnect(session: Session, user: User) -> None:
    user.telegram_chat_id = None
    user.telegram_link_token = None
    session.commit()


WELCOME = (
    "Готово! Тепер MindLeaf нагадуватиме вам тут про заняття за годину до початку "
    "та про дедлайни домашніх завдань і тестів за добу.\n\n"
    "Вимкнути нагадування: /stop"
)
UNKNOWN = (
    "Щоб отримувати нагадування, відкрийте MindLeaf і натисніть "
    "«Підключити Telegram» — бот сам відкриється з потрібним кодом."
)
STOPPED = "Нагадування вимкнено. Увімкнути знову можна в MindLeaf."


def handle_update(session: Session, update: dict) -> None:
    """A message to the bot: "/start <token>" links the chat, "/stop" unlinks it."""
    message = update.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    text = (message.get("text") or "").strip()
    if not chat_id or not text.startswith("/"):
        return

    command, _, argument = text.partition(" ")
    command = command.split("@")[0]
    reply = UNKNOWN
    if command == "/start" and argument:
        user = session.scalar(
            select(User).where(User.telegram_link_token == argument.strip())
        )
        if user is not None:
            # One chat belongs to one account: unlink it from any other first.
            other = session.scalar(select(User).where(User.telegram_chat_id == chat_id))
            if other is not None and other.id != user.id:
                other.telegram_chat_id = None
                session.flush()
            user.telegram_chat_id = chat_id
            user.telegram_link_token = None
            session.commit()
            reply = WELCOME
    elif command == "/stop":
        user = session.scalar(select(User).where(User.telegram_chat_id == chat_id))
        if user is not None:
            disconnect(session, user)
        reply = STOPPED

    try:
        send_message(chat_id, reply)
    except Exception:  # the link is saved either way
        log.warning("telegram reply to %s failed", chat_id)
