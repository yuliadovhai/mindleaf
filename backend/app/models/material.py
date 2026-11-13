"""Teaching materials: the tutor's library, shared with chosen students."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (
        CheckConstraint("char_length(title) BETWEEN 1 AND 200", name="title"),
        CheckConstraint("size_bytes > 0", name="size_bytes"),
        Index(None, "tutor_id"),
        # Target of the composite FKs: a share or an attachment can only use
        # a material of the same tutor.
        UniqueConstraint("id", "tutor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    content_type: Mapped[str] = mapped_column(Text)
    size_bytes: Mapped[int] = mapped_column(Integer)
    original_name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    shares: Mapped[list["MaterialShare"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )


class MaterialShare(Base):
    """A student card (and so its student and parents) may see the material."""

    __tablename__ = "material_shares"
    __table_args__ = (
        UniqueConstraint("material_id", "student_id"),
        ForeignKeyConstraint(
            ["material_id", "tutor_id"],
            ["materials.id", "materials.tutor_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["student_id", "tutor_id"],
            ["students.id", "students.tutor_id"],
            ondelete="CASCADE",
        ),
        Index(None, "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tutor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    material_id: Mapped[uuid.UUID] = mapped_column()
    student_id: Mapped[uuid.UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
