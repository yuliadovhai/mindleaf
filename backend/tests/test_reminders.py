"""Meeting links on lessons and Telegram reminders (bot linking, scheduler run)."""

import dataclasses
import hashlib
from datetime import timedelta

import pytest

from app.api import notifications
from app.services import clock, telegram
from tests.factories import NOW, create_lesson, iso

CRON = {"X-Cron-Token": "cron-secret"}
# Telegram echoes the hex digest of TELEGRAM_WEBHOOK_SECRET (see webhook_secret).
HOOK = {"X-Telegram-Bot-Api-Secret-Token": hashlib.sha256(b"hook+/=secret").hexdigest()}


@pytest.fixture
def bot(monkeypatch):
    """A configured bot whose messages land in a list instead of Telegram."""
    configured = dataclasses.replace(
        telegram.settings,
        telegram_bot_token="123:abc",
        telegram_bot_username="mindleaf_test_bot",
        telegram_webhook_secret="hook+/=secret",
        cron_token="cron-secret",
    )
    monkeypatch.setattr(telegram, "settings", configured)
    monkeypatch.setattr(notifications, "settings", configured)
    sent: list[tuple[int, str]] = []
    monkeypatch.setattr(
        telegram, "send_message", lambda chat, text: sent.append((chat, text))
    )
    return sent


def _start(client, token: str, chat_id: int):
    update = {"message": {"chat": {"id": chat_id}, "text": f"/start {token}"}}
    return client.post("/api/telegram/webhook", json=update, headers=HOOK)


def _link(client, chat_id: int) -> None:
    url = client.post("/api/me/telegram").json()["url"]
    token = url.split("start=")[1]
    assert _start(client, token, chat_id).status_code == 200


# ---------- meeting links ----------


def test_student_link_is_the_default_and_a_lesson_may_override_it(family, as_tutor):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    response = tutor.patch(
        f"/api/students/{olena}", json={"meeting_url": "https://meet.google.com/abc"}
    )
    assert response.json()["meeting_url"] == "https://meet.google.com/abc"

    usual = create_lesson(tutor, olena, starts_at=iso(timedelta(days=4)))
    assert usual["meeting_url"] is None
    assert usual["join_url"] == "https://meet.google.com/abc"

    special = create_lesson(
        tutor,
        olena,
        starts_at=iso(timedelta(days=5)),
        meeting_url="https://zoom.us/j/1",
    )
    assert special["join_url"] == "https://zoom.us/j/1"


def test_meeting_link_must_be_a_web_address(family, as_tutor):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    bad = tutor.patch(
        f"/api/students/{olena}", json={"meeting_url": "javascript:alert(1)"}
    )
    assert bad.status_code == 422
    cleared = tutor.patch(f"/api/students/{olena}", json={"meeting_url": "  "})
    assert cleared.json()["meeting_url"] is None


def test_portal_shows_the_join_link(family, as_tutor, as_user):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    tutor.patch(
        f"/api/students/{olena}", json={"meeting_url": "https://meet.google.com/x"}
    )
    lessons = as_user(family["kid"]).get("/api/portal/lessons").json()
    assert {lesson["join_url"] for lesson in lessons} == {"https://meet.google.com/x"}


# ---------- linking the bot ----------


def test_linking_needs_a_configured_bot(family, as_user):
    response = as_user(family["kid"]).post("/api/me/telegram")
    assert response.status_code == 409
    assert response.json()["detail"] == "telegram_disabled"
    assert as_user(family["kid"]).get("/api/me").json()["telegram_available"] is False


def test_start_with_the_token_links_the_chat(bot, family, as_user):
    kid = as_user(family["kid"])
    url = kid.post("/api/me/telegram").json()["url"]
    assert url.startswith("https://t.me/mindleaf_test_bot?start=")
    assert kid.get("/api/me").json()["telegram_connected"] is False

    assert _start(kid, url.split("start=")[1], 555).status_code == 200
    me = kid.get("/api/me").json()
    assert me["telegram_connected"] is True and me["telegram_available"] is True
    assert bot[-1][0] == 555 and "Готово" in bot[-1][1]

    # The token is one-time: a second /start with it links nothing.
    assert _start(kid, url.split("start=")[1], 777).status_code == 200
    assert family["kid"].telegram_chat_id == 555


def test_webhook_rejects_a_wrong_secret(bot, family, as_user):
    response = as_user(family["kid"]).post(
        "/api/telegram/webhook",
        json={"message": {"chat": {"id": 1}, "text": "/start x"}},
        headers={"X-Telegram-Bot-Api-Secret-Token": "nope"},
    )
    assert response.status_code == 401


def test_stop_and_unlink(bot, family, as_user):
    kid = as_user(family["kid"])
    _link(kid, 555)
    assert kid.delete("/api/me/telegram").status_code == 204
    assert kid.get("/api/me").json()["telegram_connected"] is False

    _link(kid, 555)
    update = {"message": {"chat": {"id": 555}, "text": "/stop"}}
    kid.post("/api/telegram/webhook", json=update, headers=HOOK)
    assert family["kid"].telegram_chat_id is None


# ---------- the scheduler run ----------


def test_run_needs_the_cron_token(bot, client):
    assert client.post("/api/internal/reminders/run").status_code == 401
    wrong = client.post("/api/internal/reminders/run", headers={"X-Cron-Token": "x"})
    assert wrong.status_code == 401


def test_lesson_reminder_goes_to_everyone_once(
    bot, family, as_tutor, as_user, monkeypatch
):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    tutor.patch(
        f"/api/students/{olena}", json={"meeting_url": "https://meet.google.com/q"}
    )
    soon = create_lesson(
        tutor, olena, starts_at=iso(timedelta(minutes=50)), topic="Дроби"
    )
    _link(tutor, 100)
    _link(as_user(family["kid"]), 200)
    _link(as_user(family["mom"]), 300)
    bot.clear()

    first = tutor.post("/api/internal/reminders/run", headers=CRON).json()
    assert first["by_kind"] == {"lesson": 3}
    chats = {chat: text for chat, text in bot}
    assert set(chats) == {100, 200, 300}
    assert "сьогодні о 12:50" in chats[200]
    assert "Дроби" in chats[200] and "https://meet.google.com/q" in chats[200]
    assert "Олена" in chats[100]  # the tutor sees the student's name

    # Ten minutes later the same lesson is not reminded again.
    monkeypatch.setattr(clock, "now", lambda: NOW + timedelta(minutes=10))
    again = tutor.post("/api/internal/reminders/run", headers=CRON).json()
    assert again["sent"] == 0
    assert soon["id"]


def test_far_cancelled_and_unlinked_lessons_are_skipped(bot, family, as_tutor, as_user):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    create_lesson(tutor, olena, starts_at=iso(timedelta(hours=3)))
    create_lesson(
        tutor, olena, starts_at=iso(timedelta(minutes=30)), status="cancelled"
    )
    _link(as_user(family["kid"]), 200)
    bot.clear()

    result = tutor.post("/api/internal/reminders/run", headers=CRON).json()
    assert result["sent"] == 0
    assert bot == []


def test_deadline_reminders_skip_what_is_handed_in(bot, family, as_tutor, as_user):
    tutor = as_tutor(family["tutor"])
    olena = family["olena"]["id"]
    due = iso(timedelta(hours=20))
    open_hw = tutor.post(
        "/api/homework-assignments",
        json={"student_id": olena, "title": "Вправи 1-5", "due_at": due},
    )
    assert open_hw.status_code == 201, open_hw.text
    done_hw = tutor.post(
        "/api/homework-assignments",
        json={"student_id": olena, "title": "Вже здано", "due_at": due},
    ).json()
    kid = as_user(family["kid"])
    handed_in = kid.put(
        f"/api/portal/homework-assignments/{done_hw['id']}/submission",
        json={"text": "готово", "photo_keys": []},
    )
    assert handed_in.status_code == 200, handed_in.text
    _link(kid, 200)
    bot.clear()

    result = tutor.post("/api/internal/reminders/run", headers=CRON).json()
    texts = [text for _, text in bot]
    assert result["by_kind"].get("homework") == 1
    assert any("Вправи 1-5" in t and "завтра о 08:00" in t for t in texts)
    assert not any("Вже здано" in t for t in texts)


def test_blocked_bot_unlinks_the_chat(bot, family, as_tutor, as_user, monkeypatch):
    tutor = as_tutor(family["tutor"])
    create_lesson(tutor, family["olena"]["id"], starts_at=iso(timedelta(minutes=40)))
    _link(as_user(family["kid"]), 200)

    def blocked(chat, text):
        raise telegram.ChatGone

    monkeypatch.setattr(telegram, "send_message", blocked)
    result = tutor.post("/api/internal/reminders/run", headers=CRON).json()
    assert result["errors"] == 1
    assert family["kid"].telegram_chat_id is None


# ---------- pointing the bot at the server ----------


def test_webhook_setup_sends_a_secret_telegram_accepts(bot, client, monkeypatch):
    calls = []
    monkeypatch.setattr(
        telegram, "_call", lambda method, payload: calls.append(payload) or {"ok": True}
    )
    response = client.post("/api/internal/telegram/webhook", headers=CRON)
    assert response.status_code == 200
    secret = calls[0]["secret_token"]
    assert secret == HOOK["X-Telegram-Bot-Api-Secret-Token"]
    assert secret.isalnum()  # Telegram allows only A-Z a-z 0-9 _ -
    assert calls[0]["url"].endswith("/api/telegram/webhook")


def test_webhook_setup_explains_a_telegram_refusal(bot, client, monkeypatch):
    def refuse(method, payload):
        raise telegram.TelegramError(401, "Unauthorized")

    monkeypatch.setattr(telegram, "_call", refuse)
    response = client.post("/api/internal/telegram/webhook", headers=CRON)
    assert response.status_code == 502
    assert response.json()["detail"] == "telegram: 401 Unauthorized"
