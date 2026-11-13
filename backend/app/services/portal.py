"""What students and parents see. Everything is limited to linked cards.

Students see their lessons and homework but no money and no private notes.
Parents also see prices, payments and the balance, and may cancel a planned
lesson up to the tutor's cancel_notice_hours before it starts.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Lesson, LessonStatus, Payment, Relation, Role, Student, User
from app.services import access, balances, clock, lessons
from app.services.errors import Conflict, Forbidden, NotFound


@dataclass(frozen=True)
class PortalStudent:
    student: Student
    relation: str
    balance: int | None  # parents only


def list_students(session: Session, user: User) -> list[PortalStudent]:
    links = access.linked_students(session, user)
    result = []
    for link in sorted(links.values(), key=lambda link: link.student.full_name):
        balance = None
        if link.relation == Relation.parent:
            student = link.student
            balance = balances.balance_of(session, student.tutor_id, student.id)
        result.append(PortalStudent(link.student, link.relation, balance))
    return result


def _visible_student_ids(
    session: Session, user: User, student_id: uuid.UUID | None
) -> list[uuid.UUID]:
    linked = list(access.linked_students(session, user))
    if student_id is None:
        return linked
    return [student_id] if student_id in linked else []


def list_lessons(
    session: Session,
    user: User,
    *,
    student_id: uuid.UUID | None = None,
    starts_from: datetime | None = None,
    starts_before: datetime | None = None,
) -> list[Lesson]:
    ids = _visible_student_ids(session, user, student_id)
    if not ids:
        return []
    query = select(Lesson).where(Lesson.student_id.in_(ids))
    if starts_from is not None:
        query = query.where(Lesson.starts_at >= starts_from)
    if starts_before is not None:
        query = query.where(Lesson.starts_at < starts_before)
    return list(session.scalars(query.order_by(Lesson.starts_at, Lesson.created_at)))


def get_lesson(session: Session, user: User, lesson_id: uuid.UUID) -> Lesson:
    lesson = session.get(Lesson, lesson_id)
    if lesson is None:
        raise NotFound
    access.require_link(session, user, lesson.student_id)
    return lesson


def cancel_deadline(lesson: Lesson) -> datetime:
    return lesson.starts_at - timedelta(hours=lesson.student.tutor.cancel_notice_hours)


def can_cancel(user: User, lesson: Lesson) -> bool:
    return (
        user.role == Role.parent
        and lesson.status == LessonStatus.planned
        and clock.now() <= cancel_deadline(lesson)
    )


def cancel_lesson(session: Session, user: User, lesson_id: uuid.UUID) -> Lesson:
    """Only parents cancel. Later than the deadline only the tutor can."""
    lesson = get_lesson(session, user, lesson_id)
    if user.role != Role.parent:
        raise Forbidden
    if lesson.status != LessonStatus.planned:
        raise Conflict("lesson_not_planned")
    if clock.now() > cancel_deadline(lesson):
        raise Conflict("cancel_too_late")
    lessons.mark_status(lesson, LessonStatus.cancelled, by=user.id)
    session.commit()
    session.refresh(lesson, ["canceller"])
    return lesson


def list_payments(
    session: Session,
    user: User,
    *,
    student_id: uuid.UUID | None = None,
    paid_from: datetime | None = None,
    paid_before: datetime | None = None,
) -> list[Payment]:
    """Parents only: students do not see money."""
    if user.role != Role.parent:
        raise Forbidden
    ids = _visible_student_ids(session, user, student_id)
    if not ids:
        return []
    query = select(Payment).where(Payment.student_id.in_(ids))
    if paid_from is not None:
        query = query.where(Payment.paid_at >= paid_from)
    if paid_before is not None:
        query = query.where(Payment.paid_at < paid_before)
    order = (Payment.paid_at.desc(), Payment.created_at.desc())
    return list(session.scalars(query.order_by(*order)))
