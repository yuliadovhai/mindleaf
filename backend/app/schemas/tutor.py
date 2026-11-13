import uuid

from app.schemas.common import OutDatetime, ResponseModel


class TutorOut(ResponseModel):
    id: uuid.UUID
    email: str | None
    name: str | None
    created_at: OutDatetime
