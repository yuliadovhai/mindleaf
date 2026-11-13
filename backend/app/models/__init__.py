"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.access import Invite, Relation, StudentLink
from app.models.homework import (
    HomeworkSubmission,
    SubmissionPhoto,
    SubmissionStatus,
)
from app.models.lesson import Lesson, LessonStatus
from app.models.payment import Payment, PaymentMethod
from app.models.student import Student
from app.models.user import Role, User

__all__ = [
    "HomeworkSubmission",
    "Invite",
    "Lesson",
    "LessonStatus",
    "Payment",
    "PaymentMethod",
    "Relation",
    "Role",
    "Student",
    "StudentLink",
    "SubmissionPhoto",
    "SubmissionStatus",
    "User",
]
