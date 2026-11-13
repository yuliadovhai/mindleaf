"""Local file storage endpoints (docker compose only; S3 replaces them in AWS).

Both are protected by the HMAC signature that LocalStorage put into the URL,
not by a bearer token: the browser uses them like presigned S3 URLs.
"""

import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response

from app.storage import LocalStorage, Storage, content_type_of, get_storage

router = APIRouter(prefix="/files", tags=["files (local only)"])


def _local(storage: Storage = Depends(get_storage)) -> LocalStorage:
    if not isinstance(storage, LocalStorage):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    return storage


@router.post("/upload", status_code=status.HTTP_204_NO_CONTENT)
async def upload(
    key: str = Form(),
    content_type: str = Form(),
    max_bytes: int = Form(),
    expires: int = Form(),
    signature: str = Form(),
    file: UploadFile = File(),
    storage: LocalStorage = Depends(_local),
) -> Response:
    parts = ("upload", key, content_type, str(max_bytes), str(expires))
    if expires < time.time() or not storage.verify(signature, *parts):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "bad or expired signature")
    if file.content_type != content_type:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "wrong content type")
    data = await file.read(max_bytes + 1)
    if not data or len(data) > max_bytes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "wrong size")
    path = storage.path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{key:path}")
def download(
    key: str,
    expires: int,
    signature: str,
    storage: LocalStorage = Depends(_local),
) -> FileResponse:
    if expires < time.time() or not storage.verify(
        signature, "download", key, str(expires)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "bad or expired signature")
    try:
        path = storage.path(key)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found") from None
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    return FileResponse(path, media_type=content_type_of(key))
