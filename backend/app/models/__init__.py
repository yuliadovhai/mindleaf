"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.access import Invite, Relation, StudentLink
from app.models.homework import (
    HomeworkSubmission,
    SubmissionPhoto,
    SubmissionStatus,
)
from app.models.lesson import Lesson, LessonStatus
from app.models.material import Material, MaterialShare
from app.models.payment import Payment, PaymentMethod
from app.models.quiz import (
    AssignmentStatus,
    GradedBy,
    QuestionKind,
    Quiz,
    QuizAnswer,
    QuizAssignment,
    QuizQuestion,
)
from app.models.student import Student
from app.models.user import Role, User

__all__ = [
    "AssignmentStatus",
    "GradedBy",
    "HomeworkSubmission",
    "Invite",
    "Lesson",
    "LessonStatus",
    "Payment",
    "Material",
    "MaterialShare",
    "PaymentMethod",
    "QuestionKind",
    "Quiz",
    "QuizAnswer",
    "QuizAssignment",
    "QuizQuestion",
    "Relation",
    "Role",
    "Student",
    "StudentLink",
    "SubmissionPhoto",
    "SubmissionStatus",
    "User",
]
