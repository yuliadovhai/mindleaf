import uuid
from typing import Annotated, Any, Literal, Self

from pydantic import Field, model_validator

from app.models import SubmissionStatus
from app.schemas.common import InDatetime, OutDatetime, RequestModel, ResponseModel
from app.storage import MAX_PHOTO_BYTES, Storage

PhotoType = Literal["image/jpeg", "image/png", "image/heic"]


class UploadRequest(RequestModel):
    content_type: PhotoType
    size_bytes: Annotated[int, Field(ge=1, le=MAX_PHOTO_BYTES)] = Field(
        description="Розмір файлу в байтах, до 10 МБ"
    )


class UploadOut(ResponseModel):
    """Send the file as multipart/form-data: every `fields` entry, then `file`."""

    url: str
    fields: dict[str, str]
    key: str = Field(description="Передайте його далі (photo_keys або key матеріалу)")
    expires_at: int = Field(description="Unix-час, до якого діє посилання")


class HomeworkSubmit(RequestModel):
    text: Annotated[str, Field(max_length=5000)] | None = None
    photo_keys: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _not_empty(self) -> Self:
        if not self.text and not self.photo_keys:
            raise ValueError("send text, photos or both")
        return self


class HomeworkReview(RequestModel):
    feedback: Annotated[str, Field(max_length=2000)] | None = None
    grade: Annotated[int, Field(ge=1, le=12)] | None = Field(
        None, description="Оцінка за 12-бальною шкалою"
    )

    @model_validator(mode="after")
    def _not_empty(self) -> Self:
        if self.feedback is None and self.grade is None:
            raise ValueError("send feedback, a grade or both")
        return self


class PhotoOut(ResponseModel):
    key: str
    url: str = Field(description="Тимчасове посилання на 15 хвилин")


class HomeworkOut(ResponseModel):
    """A submission; exactly one of lesson_id / homework_id is set."""

    id: uuid.UUID
    lesson_id: uuid.UUID | None
    lesson_starts_at: OutDatetime | None
    homework_id: uuid.UUID | None
    title: str | None = Field(description="Назва окремого ДЗ")
    due_at: OutDatetime | None
    task: str | None = Field(description="Текст завдання")
    student_id: uuid.UUID
    student_full_name: str
    text: str | None
    photos: list[PhotoOut]
    status: SubmissionStatus
    feedback: str | None
    grade: int | None
    submitted_at: OutDatetime
    reviewed_at: OutDatetime | None

    @classmethod
    def of(cls, submission: Any, storage: Storage) -> "HomeworkOut":
        lesson, homework = submission.lesson, submission.homework
        return cls(
            id=submission.id,
            lesson_id=submission.lesson_id,
            lesson_starts_at=lesson.starts_at if lesson else None,
            homework_id=submission.homework_id,
            title=homework.title if homework else None,
            due_at=homework.due_at if homework else None,
            task=lesson.homework if lesson else homework.description,
            student_id=submission.student_id,
            student_full_name=submission.student.full_name,
            text=submission.text,
            photos=[
                PhotoOut(key=p.storage_key, url=storage.presign_download(p.storage_key))
                for p in submission.photos
            ],
            status=submission.status,
            feedback=submission.feedback,
            grade=submission.grade,
            submitted_at=submission.submitted_at,
            reviewed_at=submission.reviewed_at,
        )


# ---------- homework assignments ----------

Title = Annotated[str, Field(min_length=1, max_length=200)]
Description = Annotated[str, Field(max_length=5000)]


class AssignmentCreate(RequestModel):
    student_id: uuid.UUID
    title: Title
    description: Description | None = None
    due_at: InDatetime | None = None
    material_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class AssignmentUpdate(RequestModel):
    title: Title | None = None
    description: Description | None = None
    due_at: InDatetime | None = None
    material_ids: list[uuid.UUID] | None = Field(None, max_length=20)


class AttachedMaterial(ResponseModel):
    id: uuid.UUID
    title: str
    content_type: str
    original_name: str
    download_url: str


class HomeworkAssignmentOut(ResponseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_full_name: str
    title: str
    description: str | None
    due_at: OutDatetime | None
    materials: list[AttachedMaterial]
    submission_status: SubmissionStatus | None = Field(description="null — ще не здано")
    grade: int | None
    created_at: OutDatetime

    @classmethod
    def of(
        cls, assignment: Any, submission: Any | None, storage: Storage
    ) -> "HomeworkAssignmentOut":
        return cls(
            id=assignment.id,
            student_id=assignment.student_id,
            student_full_name=assignment.student.full_name,
            title=assignment.title,
            description=assignment.description,
            due_at=assignment.due_at,
            materials=[
                AttachedMaterial(
                    id=a.material.id,
                    title=a.material.title,
                    content_type=a.material.content_type,
                    original_name=a.material.original_name,
                    download_url=storage.presign_download(a.material.storage_key),
                )
                for a in assignment.attachments
            ],
            submission_status=submission.status if submission else None,
            grade=submission.grade if submission else None,
            created_at=assignment.created_at,
        )


class HomeworkAssignmentDetail(HomeworkAssignmentOut):
    submission: HomeworkOut | None
