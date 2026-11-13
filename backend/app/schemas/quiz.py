import uuid
from typing import Annotated, Any, Self

from pydantic import Field, model_validator

from app.models import (
    AssignmentStatus,
    GenerationStatus,
    GradedBy,
    QuestionKind,
    QuizStatus,
)
from app.schemas.common import InDatetime, OutDatetime, RequestModel, ResponseModel

Points = Annotated[int, Field(ge=1, le=100)]


# ---------- tutor: quiz definitions ----------


class OptionIn(RequestModel):
    text: Annotated[str, Field(min_length=1, max_length=500)]
    correct: bool = False


class QuestionIn(RequestModel):
    kind: QuestionKind
    prompt: Annotated[str, Field(min_length=1, max_length=2000)]
    points: Points = 1
    options: list[OptionIn] | None = Field(
        None, description="Для single/multiple: 2–10 варіантів"
    )
    reference_answer: Annotated[str, Field(min_length=1, max_length=2000)] | None = (
        Field(None, description="Для text: еталонна відповідь для перевірки")
    )

    @model_validator(mode="after")
    def _shape_matches_kind(self) -> Self:
        if self.kind == QuestionKind.text:
            if self.options is not None:
                raise ValueError("text questions have no options")
            if self.reference_answer is None:
                raise ValueError("text questions need reference_answer")
            return self
        if self.reference_answer is not None:
            raise ValueError("choice questions have no reference_answer")
        if self.options is None or not 2 <= len(self.options) <= 10:
            raise ValueError("choice questions need 2-10 options")
        correct = sum(option.correct for option in self.options)
        if self.kind == QuestionKind.single and correct != 1:
            raise ValueError("single-choice questions need exactly one correct option")
        if self.kind == QuestionKind.multiple and correct < 1:
            raise ValueError("multiple-choice questions need a correct option")
        return self


class QuizIn(RequestModel):
    title: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str, Field(max_length=2000)] | None = None
    questions: list[QuestionIn] = Field(min_length=1, max_length=50)


class OptionOut(ResponseModel):
    id: str
    text: str


class QuestionOut(ResponseModel):
    id: uuid.UUID
    position: int
    kind: QuestionKind
    prompt: str
    points: int
    options: list[OptionOut] | None
    correct_options: list[str] | None
    reference_answer: str | None


class QuizOut(ResponseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: QuizStatus = Field(
        description="draft — згенерована чернетка, ще не призначити"
    )
    source_material_id: uuid.UUID | None
    questions: list[QuestionOut]
    max_score: int
    assignment_count: int
    created_at: OutDatetime
    updated_at: OutDatetime


class QuizSummaryOut(ResponseModel):
    id: uuid.UUID
    title: str
    status: QuizStatus
    question_count: int
    max_score: int
    assignment_count: int
    updated_at: OutDatetime


# ---------- assignments ----------


class AssignmentCreate(RequestModel):
    student_id: uuid.UUID
    due_at: InDatetime | None = None


class AssignmentOut(ResponseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    quiz_title: str
    student_id: uuid.UUID
    student_full_name: str
    status: AssignmentStatus
    due_at: OutDatetime | None
    score: int | None = Field(description="Сума балів, коли все оцінено")
    max_score: int
    submitted_at: OutDatetime | None
    graded_at: OutDatetime | None
    created_at: OutDatetime

    @classmethod
    def of(cls, assignment: Any) -> "AssignmentOut":
        return cls(
            id=assignment.id,
            quiz_id=assignment.quiz_id,
            quiz_title=assignment.quiz.title,
            student_id=assignment.student_id,
            student_full_name=assignment.student.full_name,
            status=assignment.status,
            due_at=assignment.due_at,
            score=assignment.score,
            max_score=assignment.max_score,
            submitted_at=assignment.submitted_at,
            graded_at=assignment.graded_at,
            created_at=assignment.created_at,
        )


class AnswerOut(ResponseModel):
    selected_options: list[str] | None
    text_answer: str | None
    points: int | None
    feedback: str | None
    graded_by: GradedBy | None


class AssignmentQuestionOut(ResponseModel):
    """A question with the student's answer. What is revealed depends on who asks."""

    id: uuid.UUID
    position: int
    kind: QuestionKind
    prompt: str
    points: int
    options: list[OptionOut] | None
    correct_options: list[str] | None = Field(
        description="Учню — лише після здачі; репетитору — завжди"
    )
    reference_answer: str | None = Field(description="Лише репетитору")
    answer: AnswerOut | None


class AssignmentDetailOut(AssignmentOut):
    questions: list[AssignmentQuestionOut]

    @classmethod
    def build(
        cls, assignment: Any, *, show_correct: bool, show_reference: bool
    ) -> "AssignmentDetailOut":
        answers = {answer.question_id: answer for answer in assignment.answers}
        questions = []
        for question in assignment.quiz.questions:
            answer = answers.get(question.id)
            questions.append(
                AssignmentQuestionOut(
                    id=question.id,
                    position=question.position,
                    kind=question.kind,
                    prompt=question.prompt,
                    points=question.points,
                    options=question.options,
                    correct_options=question.correct_options if show_correct else None,
                    reference_answer=(
                        question.reference_answer if show_reference else None
                    ),
                    answer=AnswerOut.model_validate(answer) if answer else None,
                )
            )
        return cls(**AssignmentOut.of(assignment).model_dump(), questions=questions)


class AnswerGrade(RequestModel):
    points: Annotated[int, Field(ge=0, le=100)]
    feedback: Annotated[str, Field(max_length=2000)] | None = None


# ---------- student: submitting ----------


class AnswerIn(RequestModel):
    question_id: uuid.UUID
    selected_options: list[str] | None = Field(None, max_length=10)
    text_answer: Annotated[str, Field(max_length=2000)] | None = None


class QuizSubmit(RequestModel):
    answers: list[AnswerIn] = Field(max_length=50)


# ---------- AI generation from a material ----------


class GenerationRequest(RequestModel):
    question_count: Annotated[int, Field(ge=1, le=20)] = 8
    include_written: bool = Field(
        True, description="Додати питання з письмовою відповіддю (перевіряє ШІ)"
    )
    instructions: Annotated[str, Field(max_length=1000)] | None = Field(
        None, description="Побажання: тема, рівень, на що звернути увагу"
    )


class GenerationOut(ResponseModel):
    id: uuid.UUID
    material_id: uuid.UUID | None
    material_title: str | None
    status: GenerationStatus
    question_count: int
    include_written: bool
    instructions: str | None
    quiz_id: uuid.UUID | None = Field(description="Чернетка, коли status = done")
    error: str | None
    created_at: OutDatetime
    finished_at: OutDatetime | None

    @classmethod
    def of(cls, job: Any) -> "GenerationOut":
        return cls(
            id=job.id,
            material_id=job.material_id,
            material_title=job.material.title if job.material else None,
            status=job.status,
            question_count=job.question_count,
            include_written=job.include_written,
            instructions=job.instructions,
            quiz_id=job.quiz_id,
            error=job.error,
            created_at=job.created_at,
            finished_at=job.finished_at,
        )
