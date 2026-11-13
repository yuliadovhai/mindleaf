"""The data the grader receives from the API and sends back."""

from pydantic import BaseModel


class PendingQuestion(BaseModel):
    question_id: str
    prompt: str
    reference_answer: str
    max_points: int
    answer: str


class GradingTask(BaseModel):
    assignment_id: str
    quiz_title: str
    questions: list[PendingQuestion]


class QuestionResult(BaseModel):
    question_id: str
    points: int
    feedback: str | None = None


class GradingFailed(Exception):
    """The model refused, ran out of tokens or returned nothing usable."""
