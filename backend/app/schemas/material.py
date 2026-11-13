import uuid
from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import OutDatetime, RequestModel, ResponseModel
from app.storage import MAX_MATERIAL_BYTES

MaterialType = Literal[
    "application/pdf", "image/jpeg", "image/png", "text/plain", "text/markdown"
]
Title = Annotated[str, Field(min_length=1, max_length=200)]
Description = Annotated[str, Field(max_length=2000)]


class MaterialUploadRequest(RequestModel):
    content_type: MaterialType
    size_bytes: Annotated[int, Field(ge=1, le=MAX_MATERIAL_BYTES)]


class MaterialCreate(RequestModel):
    key: str = Field(description="key з відповіді /api/materials/uploads")
    title: Title
    description: Description | None = None
    original_name: Annotated[str, Field(min_length=1, max_length=255)]
    size_bytes: Annotated[int, Field(ge=1, le=MAX_MATERIAL_BYTES)]


class MaterialUpdate(RequestModel):
    title: Title | None = None
    description: Description | None = None


class SharesUpdate(RequestModel):
    student_ids: list[uuid.UUID] = Field(max_length=200)


class SharedWith(ResponseModel):
    student_id: uuid.UUID
    full_name: str


class MaterialOut(ResponseModel):
    id: uuid.UUID
    title: str
    description: str | None
    content_type: str
    size_bytes: int
    original_name: str
    download_url: str = Field(description="Тимчасове посилання на 15 хвилин")
    shared_with: list[SharedWith]
    created_at: OutDatetime


class MemberMaterialOut(ResponseModel):
    """What a student or a parent sees: no list of other students."""

    id: uuid.UUID
    title: str
    description: str | None
    content_type: str
    size_bytes: int
    original_name: str
    download_url: str
    student_ids: list[uuid.UUID] = Field(description="Для кого з ваших учнів")
    created_at: OutDatetime
