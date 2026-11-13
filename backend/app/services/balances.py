"""The one balance formula of the product.

    balance = sum of payments - sum of prices of lessons with status "done"

Negative balance is debt, positive is prepayment. Only "done" lessons cost money;
planned, cancelled and missed ones do not. The balance is never stored: it is
computed over all time, so changing a status or a payment fixes it at once.
"""

import uuid
from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Lesson, LessonStatus, Payment, Student


def compute_balance(payments: Iterable[int], lessons: Iterable[tuple[str, int]]) -> int:
    """Pure formula: payment amounts and (status, price) of lessons, in kopecks."""
    paid = sum(payments)
    owed = sum(price for status, price in lessons if status == LessonStatus.done)
    return paid - owed


def balances(
    session: Session,
    tutor_id: uuid.UUID,
    student_ids: Iterable[uuid.UUID] | None = None,
) -> dict[uuid.UUID, int]:
    """The same formula in one SQL query, for all (or some) students of a tutor."""
    paid = (
        select(Payment.student_id, func.sum(Payment.amount).label("total"))
        .where(Payment.tutor_id == tutor_id)
        .group_by(Payment.student_id)
        .subquery()
    )
    owed = (
        select(Lesson.student_id, func.sum(Lesson.price).label("total"))
        .where(Lesson.tutor_id == tutor_id, Lesson.status == LessonStatus.done)
        .group_by(Lesson.student_id)
        .subquery()
    )
    query = (
        select(
            Student.id,
            func.coalesce(paid.c.total, 0) - func.coalesce(owed.c.total, 0),
        )
        .outerjoin(paid, paid.c.student_id == Student.id)
        .outerjoin(owed, owed.c.student_id == Student.id)
        .where(Student.tutor_id == tutor_id)
    )
    if student_ids is not None:
        query = query.where(Student.id.in_(list(student_ids)))
    return {student_id: int(balance) for student_id, balance in session.execute(query)}


def balance_of(session: Session, tutor_id: uuid.UUID, student_id: uuid.UUID) -> int:
    return balances(session, tutor_id, [student_id]).get(student_id, 0)
