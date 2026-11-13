"""Demo data for the local database.

    python -m app.seed [--tutor-sub local-dev]

Creates the tutor (if missing), 3 students, lessons for the current Kyiv week,
a few payments and at least one debtor. Re-running replaces the demo data of
this tutor only, so the lessons always fall on the current week. Last week's
done lessons are added too: without them a Monday-morning seed would have no
debt to show.
"""

import argparse
from datetime import date, datetime, time, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Lesson, LessonStatus, Payment, PaymentMethod, Student
from app.services import clock, tutors
from app.settings import TIMEZONE

DEFAULT_SUB = "local-dev"

STUDENTS = [
    {
        "full_name": "Олена Коваль",
        "subject": "Математика",
        "default_price": 50000,
        "phone": "+380501112233",
        "telegram": "@olena_k",
        "parent_name": "Ірина Коваль",
        "parent_phone": "+380671112233",
        "notes": "Готується до НМТ",
    },
    {
        "full_name": "Андрій Шевченко",
        "subject": "Англійська мова",
        "default_price": 45000,
        "telegram": "@andrii_sh",
        "parent_name": "Петро Шевченко",
        "parent_phone": "+380632223344",
    },
    {
        "full_name": "Марія Бондар",
        "subject": "Українська мова",
        "default_price": 40000,
        "phone": "+380933334455",
    },
]

# (student index, weekday 0=Mon, hh:mm) for the current week.
THIS_WEEK = [
    (0, 0, "16:00"),
    (1, 1, "17:30"),
    (2, 2, "15:00"),
    (0, 3, "16:00"),
    (1, 4, "17:30"),
    (2, 5, "11:00"),
]
# Done lessons last week, and the payments made then.
LAST_WEEK = THIS_WEEK
PAYMENTS = [
    # Олена: paid for both of last week's lessons -> settled before this week.
    (0, 3, "17:05", 100000, PaymentMethod.card, "за 2 заняття"),
    # Андрій: paid for one of two -> owes 450 грн: the guaranteed debtor.
    (1, 1, "18:40", 45000, PaymentMethod.cash, None),
    # Марія: prepaid a month -> positive balance.
    (2, 2, "16:10", 160000, PaymentMethod.transfer, "передоплата за 4 заняття"),
]


def _at(monday: date, weekday: int, hhmm: str) -> datetime:
    hours, minutes = map(int, hhmm.split(":"))
    return datetime.combine(
        monday + timedelta(days=weekday), time(hours, minutes), tzinfo=TIMEZONE
    )


def seed(session: Session, tutor_sub: str = DEFAULT_SUB) -> dict[str, int]:
    now = clock.now()
    this_monday = now.date() - timedelta(days=now.weekday())
    last_monday = this_monday - timedelta(days=7)

    tutor = tutors.get_or_create(session, tutor_sub, name="Демо-репетитор")
    for model in (Payment, Lesson, Student):
        session.execute(delete(model).where(model.tutor_id == tutor.id))

    students = [Student(tutor_id=tutor.id, **fields) for fields in STUDENTS]
    session.add_all(students)
    session.flush()

    lessons: list[Lesson] = []
    for index, weekday, hhmm in LAST_WEEK:
        student = students[index]
        lessons.append(
            Lesson(
                tutor_id=tutor.id,
                student_id=student.id,
                starts_at=_at(last_monday, weekday, hhmm),
                duration_minutes=60,
                price=student.default_price,
                status=LessonStatus.done,
                topic="Повторення",
            )
        )
    for index, weekday, hhmm in THIS_WEEK:
        student = students[index]
        starts_at = _at(this_monday, weekday, hhmm)
        finished = starts_at + timedelta(minutes=60) <= now
        lessons.append(
            Lesson(
                tutor_id=tutor.id,
                student_id=student.id,
                starts_at=starts_at,
                duration_minutes=60,
                price=student.default_price,
                status=LessonStatus.done if finished else LessonStatus.planned,
                homework="Вправи 1–5" if finished else None,
            )
        )
    session.add_all(lessons)

    payments = [
        Payment(
            tutor_id=tutor.id,
            student_id=students[index].id,
            amount=amount,
            paid_at=_at(last_monday, weekday, hhmm),
            method=method,
            comment=comment,
        )
        for index, weekday, hhmm, amount, method, comment in PAYMENTS
    ]
    session.add_all(payments)
    session.commit()
    return {
        "students": len(students),
        "lessons": len(lessons),
        "payments": len(payments),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data for one tutor.")
    parser.add_argument("--tutor-sub", default=DEFAULT_SUB, help="Cognito sub")
    args = parser.parse_args()

    from app.db import get_sessionmaker

    with get_sessionmaker()() as session:
        counts = seed(session, args.tutor_sub)
    print(f"seeded tutor {args.tutor_sub!r}: {counts}")


if __name__ == "__main__":
    main()
