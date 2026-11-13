import uuid
from typing import Annotated, Any, Literal, Self

from pydantic import Field, model_validator

from app.models import SubmissionStatus
from app.schemas.common import OutDatetime, RequestModel, ResponseModel
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
    key: str = Field(description="Передайте його в photo_keys під час здачі ДЗ")
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
    id: uuid.UUID
    lesson_id: uuid.UUID
    lesson_starts_at: OutDatetime
    task: str | None = Field(description="Завдання з заняття")
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
        return cls(
            id=submission.id,
            lesson_id=submission.lesson_id,
            lesson_starts_at=submission.lesson.starts_at,
            task=submission.lesson.homework,
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
