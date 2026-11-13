"""Constraint names in the database are exactly the ones the code expects."""

from sqlalchemy import text

EXPECTED = {
    "users": {
        "pk_users",
        "uq_users_cognito_sub",
        "ck_users_role",
        "ck_users_cancel_notice_hours",
    },
    "students": {
        "pk_students",
        "uq_students_id_tutor_id",
        "fk_students_tutor_id_users",
        "ck_students_full_name",
        "ck_students_default_price",
    },
    "lessons": {
        "pk_lessons",
        "fk_lessons_tutor_id_users",
        "fk_lessons_student_id_tutor_id_students",
        "ck_lessons_duration_minutes",
        "ck_lessons_price",
        "ck_lessons_status",
    },
    "payments": {
        "pk_payments",
        "fk_payments_tutor_id_users",
        "fk_payments_student_id_tutor_id_students",
        "ck_payments_amount",
        "ck_payments_method",
    },
}


def test_constraint_names(db):
    for table, expected in EXPECTED.items():
        names = set(
            db.scalars(
                text(
                    "SELECT conname FROM pg_constraint "
                    "WHERE conrelid = CAST(:table AS regclass)"
                ),
                {"table": table},
            )
        )
        assert expected <= names, (table, sorted(names))
        assert not [n for n in names if n.count("ck_") > 1], (table, sorted(names))
