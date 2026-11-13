"""Teaching materials: the tutor's library, and what students and parents see."""

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_member, get_current_tutor
from app.db import get_session
from app.models import Material, User
from app.schemas.homework import UploadOut
from app.schemas.material import (
    MaterialCreate,
    MaterialOut,
    MaterialUpdate,
    MaterialUploadRequest,
    MemberMaterialOut,
    SharedWith,
    SharesUpdate,
)
from app.services import materials
from app.storage import Storage, get_storage

router = APIRouter(tags=["materials"])


def material_out(session: Session, storage: Storage, material: Material) -> MaterialOut:
    names = materials.student_names(session, {s.student_id for s in material.shares})
    return MaterialOut(
        id=material.id,
        title=material.title,
        description=material.description,
        content_type=material.content_type,
        size_bytes=material.size_bytes,
        original_name=material.original_name,
        download_url=storage.presign_download(material.storage_key),
        shared_with=sorted(
            (
                SharedWith(
                    student_id=s.student_id, full_name=names.get(s.student_id, "")
                )
                for s in material.shares
            ),
            key=lambda item: item.full_name,
        ),
        created_at=material.created_at,
    )


@router.post("/materials/uploads", response_model=UploadOut)
def request_material_upload(
    body: MaterialUploadRequest,
    tutor: User = Depends(get_current_tutor),
    storage: Storage = Depends(get_storage),
) -> UploadOut:
    """Step 1: a signed target for one file (PDF, JPEG, PNG, TXT, MD; up to 10 MB)."""
    target = materials.request_upload(
        storage, tutor.id, body.content_type, body.size_bytes
    )
    return UploadOut(
        url=target.url,
        fields=target.fields,
        key=target.key,
        expires_at=target.expires_at,
    )


@router.post(
    "/materials", response_model=MaterialOut, status_code=status.HTTP_201_CREATED
)
def create_material(
    body: MaterialCreate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> MaterialOut:
    """Step 2, after the file is uploaded: record it in the library."""
    material = materials.create_material(
        session,
        tutor.id,
        key=body.key,
        title=body.title,
        description=body.description,
        original_name=body.original_name,
        size_bytes=body.size_bytes,
    )
    return material_out(session, storage, material)


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[MaterialOut]:
    return [
        material_out(session, storage, m)
        for m in materials.list_materials(session, tutor.id)
    ]


@router.get("/materials/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> MaterialOut:
    return material_out(
        session, storage, materials.get_owned(session, tutor.id, material_id)
    )


@router.patch("/materials/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: uuid.UUID,
    body: MaterialUpdate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> MaterialOut:
    fields = body.model_dump(exclude_unset=True)
    if fields.get("title") is None:
        fields.pop("title", None)
    material = materials.update_material(session, tutor.id, material_id, fields)
    return material_out(session, storage, material)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: uuid.UUID,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
) -> Response:
    materials.delete_material(session, tutor.id, material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/materials/{material_id}/shares", response_model=MaterialOut)
def set_shares(
    material_id: uuid.UUID,
    body: SharesUpdate,
    tutor: User = Depends(get_current_tutor),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> MaterialOut:
    """Replace the list of students (and so their parents) who see the material."""
    material = materials.set_shares(session, tutor.id, material_id, body.student_ids)
    return material_out(session, storage, material)


@router.get("/portal/materials", response_model=list[MemberMaterialOut])
def list_member_materials(
    student_id: uuid.UUID | None = Query(None),
    user: User = Depends(get_current_member),
    session: Session = Depends(get_session),
    storage: Storage = Depends(get_storage),
) -> list[MemberMaterialOut]:
    """Materials the tutor shared with the caller's students."""
    return [
        MemberMaterialOut(
            id=m.id,
            title=m.title,
            description=m.description,
            content_type=m.content_type,
            size_bytes=m.size_bytes,
            original_name=m.original_name,
            download_url=storage.presign_download(m.storage_key),
            student_ids=sids,
            created_at=m.created_at,
        )
        for m, sids in materials.list_for_member(session, user, student_id)
    ]
