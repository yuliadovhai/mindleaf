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


class GenerationTask(BaseModel):
    job_id: str
    material_title: str
    content_type: str
    download_url: str
    question_count: int
    include_written: bool
    instructions: str | None = None


class GeneratedOption(BaseModel):
    text: str
    correct: bool


class GeneratedQuestion(BaseModel):
    kind: str  # single | multiple | text
    prompt: str
    points: int
    options: list[GeneratedOption] | None = None
    reference_answer: str | None = None


class GeneratedQuiz(BaseModel):
    """Shaped like the body of POST /api/quizzes; the API validates it again."""

    title: str
    description: str | None = None
    questions: list[GeneratedQuestion]
