"""The tutor's material library and sharing it with students.

Files go straight from the browser to storage (signed upload target, as with
homework photos); the API only records them. A material shared with a student
card is visible to that student and to the card's parents.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Material, MaterialShare, Student, User
from app.services import access, students
from app.services.errors import Invalid, NotFound
from app.storage import (
    EXTENSIONS,
    MATERIAL_KEY_RE,
    MATERIAL_TYPES,
    Storage,
    UploadTarget,
)


def request_upload(
    storage: Storage, tutor_id: uuid.UUID, content_type: str, size_bytes: int
) -> UploadTarget:
    key = f"materials/{tutor_id}/{uuid.uuid4().hex}.{MATERIAL_TYPES[content_type]}"
    return storage.presign_upload(key, content_type, size_bytes)


def create_material(
    session: Session,
    tutor_id: uuid.UUID,
    *,
    key: str,
    title: str,
    description: str | None,
    original_name: str,
    size_bytes: int,
) -> Material:
    """Record an uploaded file. The key must be one we issued to this tutor."""
    if not MATERIAL_KEY_RE.fullmatch(key) or not key.startswith(
        f"materials/{tutor_id}/"
    ):
        raise Invalid("bad_material_key")
    material = Material(
        tutor_id=tutor_id,
        title=title,
        description=description,
        storage_key=key,
        content_type=EXTENSIONS[key.rsplit(".", 1)[1]],
        size_bytes=size_bytes,
        original_name=original_name,
    )
    session.add(material)
    session.commit()
    return material


def get_owned(
    session: Session, tutor_id: uuid.UUID, material_id: uuid.UUID
) -> Material:
    material = session.scalar(
        select(Material).where(
            Material.id == material_id, Material.tutor_id == tutor_id
        )
    )
    if material is None:
        raise NotFound
    return material


def list_materials(session: Session, tutor_id: uuid.UUID) -> list[Material]:
    return list(
        session.scalars(
            select(Material)
            .where(Material.tutor_id == tutor_id)
            .order_by(Material.created_at.desc())
        )
    )


def update_material(
    session: Session, tutor_id: uuid.UUID, material_id: uuid.UUID, fields: dict
) -> Material:
    material = get_owned(session, tutor_id, material_id)
    for field, value in fields.items():
        setattr(material, field, value)
    session.commit()
    return material


def delete_material(
    session: Session, tutor_id: uuid.UUID, material_id: uuid.UUID
) -> None:
    """Shares and homework attachments go with it; the file stays in storage."""
    session.delete(get_owned(session, tutor_id, material_id))
    session.commit()


def set_shares(
    session: Session,
    tutor_id: uuid.UUID,
    material_id: uuid.UUID,
    student_ids: list[uuid.UUID],
) -> Material:
    """Replace the set of student cards that see this material."""
    material = get_owned(session, tutor_id, material_id)
    wanted = set(student_ids)
    for student_id in wanted:
        try:
            students.get_owned(session, tutor_id, student_id)
        except NotFound:
            raise Invalid("student_not_found") from None
    current = {share.student_id: share for share in material.shares}
    for student_id, share in current.items():
        if student_id not in wanted:
            material.shares.remove(share)
    for student_id in wanted - current.keys():
        material.shares.append(MaterialShare(tutor_id=tutor_id, student_id=student_id))
    session.commit()
    session.refresh(material)
    return material


def student_names(session: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = session.execute(
        select(Student.id, Student.full_name).where(Student.id.in_(ids))
    )
    return dict(rows.all())


# ---------- students and parents ----------


def list_for_member(
    session: Session, user: User, student_id: uuid.UUID | None = None
) -> list[tuple[Material, list[uuid.UUID]]]:
    """Materials shared with the caller's cards, with the cards each one is for."""
    linked = list(access.linked_students(session, user))
    if student_id is not None:
        linked = [student_id] if student_id in linked else []
    if not linked:
        return []
    rows = session.execute(
        select(Material, MaterialShare.student_id)
        .join(MaterialShare, MaterialShare.material_id == Material.id)
        .where(MaterialShare.student_id.in_(linked))
        .order_by(Material.created_at.desc())
    ).all()
    grouped: dict[uuid.UUID, tuple[Material, list[uuid.UUID]]] = {}
    for material, sid in rows:
        grouped.setdefault(material.id, (material, []))[1].append(sid)
    return list(grouped.values())
