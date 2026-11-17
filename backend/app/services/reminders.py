"""Telegram reminders, sent by a scheduler that calls /api/internal/reminders/run.

- a lesson: to the tutor, the student and the parents, about an hour before it;
- a homework or quiz deadline: to the student and the parents, a day before it.

Every reminder is sent once per person (table reminders_sent), so the scheduler
may run as often and as late as it likes. People without a linked Telegram chat
are skipped.
"""

import html
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    AssignmentStatus,
    HomeworkAssignment,
    HomeworkSubmission,
    Lesson,
    LessonStatus,
    QuizAssignment,
    ReminderKind,
    ReminderSent,
    StudentLink,
    User,
)
from app.services import clock, telegram
from app.settings import TIMEZONE

log = logging.getLogger(__name__)

# The scheduler runs every ~10 minutes and may be late, so the lesson window is a
# bit wider than an hour; the message always names the exact time.
LESSON_AHEAD = timedelta(minutes=75)
DEADLINE_AHEAD = timedelta(hours=24)

WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"]
MONTHS = [
    "січ", "лют", "бер", "квіт", "трав", "черв",
    "лип", "серп", "вер", "жовт", "лист", "груд",
]  # fmt: skip


@dataclass
class RunResult:
    sent: int = 0
    skipped: int = 0
    errors: int = 0
    by_kind: dict[str, int] = field(default_factory=dict)


def when(moment: datetime, now: datetime) -> str:
    """ "сьогодні о 16:00", "завтра о 10:00", "чт, 19 лист о 16:00" (Kyiv time)."""
    local = moment.astimezone(TIMEZONE)
    days = (local.date() - now.astimezone(TIMEZONE).date()).days
    time = local.strftime("%H:%M")
    if days == 0:
        return f"сьогодні о {time}"
    if days == 1:
        return f"завтра о {time}"
    return (
        f"{WEEKDAYS[local.weekday()]}, {local.day} {MONTHS[local.month - 1]} о {time}"
    )


def _linked_users(session: Session, student_id: uuid.UUID) -> list[User]:
    """The student's own account and the parents' accounts."""
    return list(
        session.scalars(
            select(User)
            .join(StudentLink, StudentLink.user_id == User.id)
            .where(StudentLink.student_id == student_id)
        )
    )


def _lesson_text(lesson: Lesson, for_tutor: bool, now: datetime) -> str:
    e = html.escape
    who = (
        e(lesson.student.full_name)
        if for_tutor
        else "з репетитором " + e(lesson.student.tutor.name or "")
    ).strip()
    lines = [f"⏰ <b>Заняття {when(lesson.starts_at, now)}</b>", who]
    if lesson.topic:
        lines.append(f"Тема: {e(lesson.topic)}")
    link = lesson.meeting_url or lesson.student.meeting_url
    if link:
        lines.append(f'<a href="{e(link, quote=True)}">Приєднатися до заняття</a>')
    return "\n".join(line for line in lines if line)


def _deadline_text(icon: str, what: str, title: str, due: datetime, now: datetime,
                   student: str, many: bool) -> str:  # fmt: skip
    e = html.escape
    text = f"{icon} <b>{what} «{e(title)}»</b>\nТреба здати {when(due, now)}"
    if many:
        text += f"\nУчень: {e(student)}"
    return text


def _send_once(
    session: Session,
    result: RunResult,
    user: User,
    kind: ReminderKind,
    object_id: uuid.UUID,
    text: str,
) -> None:
    if user.telegram_chat_id is None:
        result.skipped += 1
        return
    claimed = session.execute(
        insert(ReminderSent)
        .values(id=uuid.uuid4(), user_id=user.id, kind=kind, object_id=object_id)
        .on_conflict_do_nothing()
        .returning(ReminderSent.id)
    ).first()
    session.commit()
    if claimed is None:
        return  # already sent on an earlier run
    try:
        telegram.send_message(user.telegram_chat_id, text)
    except telegram.ChatGone:
        user.telegram_chat_id = None
        session.commit()
        result.errors += 1
        return
    except Exception:
        log.exception("reminder to %s failed", user.id)
        result.errors += 1
        return
    result.sent += 1
    result.by_kind[kind] = result.by_kind.get(kind, 0) + 1


def run(session: Session) -> RunResult:
    now = clock.now()
    result = RunResult()

    lessons = session.scalars(
        select(Lesson).where(
            Lesson.status == LessonStatus.planned,
            Lesson.starts_at > now,
            Lesson.starts_at <= now + LESSON_AHEAD,
        )
    ).all()
    for lesson in lessons:
        tutor = session.get(User, lesson.tutor_id)
        if tutor is not None:
            _send_once(session, result, tutor, ReminderKind.lesson, lesson.id,
                       _lesson_text(lesson, True, now))  # fmt: skip
        for user in _linked_users(session, lesson.student_id):
            _send_once(session, result, user, ReminderKind.lesson, lesson.id,
                       _lesson_text(lesson, False, now))  # fmt: skip

    submitted = exists().where(HomeworkSubmission.homework_id == HomeworkAssignment.id)
    homework = session.scalars(
        select(HomeworkAssignment).where(
            HomeworkAssignment.due_at > now,
            HomeworkAssignment.due_at <= now + DEADLINE_AHEAD,
            ~submitted,
        )
    ).all()
    for item in homework:
        for user in _linked_users(session, item.student_id):
            many = _has_several_students(session, user)
            _send_once(session, result, user, ReminderKind.homework, item.id,
                       _deadline_text("📚", "ДЗ", item.title, item.due_at, now,
                                      item.student.full_name, many))  # fmt: skip

    quizzes = session.scalars(
        select(QuizAssignment).where(
            QuizAssignment.status == AssignmentStatus.assigned,
            QuizAssignment.due_at > now,
            QuizAssignment.due_at <= now + DEADLINE_AHEAD,
        )
    ).all()
    for item in quizzes:
        for user in _linked_users(session, item.student_id):
            many = _has_several_students(session, user)
            _send_once(session, result, user, ReminderKind.quiz, item.id,
                       _deadline_text("📝", "Тест", item.quiz.title, item.due_at, now,
                                      item.student.full_name, many))  # fmt: skip

    return result


def _has_several_students(session: Session, user: User) -> bool:
    """A parent of two children needs the child's name in a deadline reminder."""
    links = session.scalars(
        select(StudentLink.student_id).where(StudentLink.user_id == user.id)
    ).all()
    return len(links) > 1
