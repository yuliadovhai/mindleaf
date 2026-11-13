"""The dashboard: everything is computed for the Kyiv calendar at `clock.now()`."""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AssignmentStatus,
    HomeworkSubmission,
    Lesson,
    LessonStatus,
    Payment,
    QuizAssignment,
    Student,
    SubmissionStatus,
)
from app.services import balances, clock, lessons


@dataclass(frozen=True)
class Debtor:
    student_id: uuid.UUID
    full_name: str
    balance: int
    archived: bool


@dataclass(frozen=True)
class Dashboard:
    date: date
    today: list[Lesson]
    upcoming: list[Lesson]
    income_month: int
    debt_total: int
    debtors: list[Debtor]
    homework_to_review: int
    quizzes_to_review: int


def build(session: Session, tutor_id: uuid.UUID) -> Dashboard:
    window = clock.window(clock.now())

    # Today: every status, so the tutor can mark what has happened.
    today = lessons.list_lessons(
        session,
        tutor_id,
        starts_from=window.today_start,
        starts_before=window.tomorrow_start,
    )
    # The next 7 days: only what is still planned.
    upcoming = lessons.list_lessons(
        session,
        tutor_id,
        starts_from=window.tomorrow_start,
        starts_before=window.week_end,
        status=LessonStatus.planned,
    )
    # Income is cash received this month, not the value of done lessons.
    income_month = session.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.tutor_id == tutor_id,
            Payment.paid_at >= window.month_start,
            Payment.paid_at < window.next_month_start,
        )
    )
    debtors = _debtors(session, tutor_id)
    homework_to_review = session.scalar(
        select(func.count())
        .select_from(HomeworkSubmission)
        .where(
            HomeworkSubmission.tutor_id == tutor_id,
            HomeworkSubmission.status == SubmissionStatus.submitted,
        )
    )
    quizzes_to_review = session.scalar(
        select(func.count())
        .select_from(QuizAssignment)
        .where(
            QuizAssignment.tutor_id == tutor_id,
            QuizAssignment.status == AssignmentStatus.needs_review,
        )
    )
    return Dashboard(
        date=window.today,
        today=today,
        upcoming=upcoming,
        income_month=int(income_month),
        debt_total=-sum(d.balance for d in debtors),
        debtors=debtors,
        homework_to_review=homework_to_review,
        quizzes_to_review=quizzes_to_review,
    )


def _debtors(session: Session, tutor_id: uuid.UUID) -> list[Debtor]:
    """Students with a negative balance, archived ones too; biggest debt first."""
    owing = {
        student_id: balance
        for student_id, balance in balances.balances(session, tutor_id).items()
        if balance < 0
    }
    if not owing:
        return []
    rows = session.execute(
        select(Student.id, Student.full_name, Student.archived).where(
            Student.tutor_id == tutor_id, Student.id.in_(owing)
        )
    )
    debtors = [
        Debtor(student_id, full_name, owing[student_id], archived)
        for student_id, full_name, archived in rows
    ]
    return sorted(debtors, key=lambda d: (d.balance, d.full_name))
