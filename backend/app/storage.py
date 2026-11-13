"""Where homework photos live.

The browser never sends a photo through the API Lambda: it gets a short-lived
signed upload target and talks to storage directly.

- S3Storage (AWS): presigned POST / GET. Signing is local computation with the
  Lambda's credentials, so the API Lambda needs no network access to S3.
- LocalStorage (docker compose): files on a volume; the API itself accepts the
  upload and serves downloads, both behind an HMAC signature.
"""

import hashlib
import hmac
import re
import secrets
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.settings import settings

URL_TTL_SECONDS = 15 * 60
MAX_PHOTO_BYTES = 10 * 1024 * 1024
CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/heic": "heic"}
EXTENSIONS = {ext: ct for ct, ext in CONTENT_TYPES.items()}
# homework/<lesson uuid>/<photo uuid>.<ext> - nothing else is ever accepted.
KEY_RE = re.compile(
    r"^homework/[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png|heic)$",
)


@dataclass(frozen=True)
class UploadTarget:
    url: str
    fields: dict[str, str]
    key: str
    expires_at: int  # unix seconds


class Storage(Protocol):
    def presign_upload(
        self, key: str, content_type: str, max_bytes: int
    ) -> UploadTarget: ...

    def presign_download(self, key: str) -> str: ...


def content_type_of(key: str) -> str:
    return EXTENSIONS[key.rsplit(".", 1)[1]]


class S3Storage:
    def __init__(self, bucket: str, region: str) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self._s3 = boto3.client(
            "s3", region_name=region, config=Config(signature_version="s3v4")
        )

    def presign_upload(
        self, key: str, content_type: str, max_bytes: int
    ) -> UploadTarget:
        post = self._s3.generate_presigned_post(
            Bucket=self.bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes],
            ],
            ExpiresIn=URL_TTL_SECONDS,
        )
        return UploadTarget(
            url=post["url"],
            fields=post["fields"],
            key=key,
            expires_at=int(time.time()) + URL_TTL_SECONDS,
        )

    def presign_download(self, key: str) -> str:
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=URL_TTL_SECONDS,
        )


class LocalStorage:
    def __init__(self, directory: str, secret: str, base_url: str) -> None:
        self.root = Path(directory)
        # Without a configured secret, links stop working after a restart:
        # acceptable for local development only.
        self._secret = (secret or secrets.token_hex(32)).encode()
        self.base_url = base_url

    def sign(self, *parts: str) -> str:
        message = "\n".join(parts).encode()
        return hmac.new(self._secret, message, hashlib.sha256).hexdigest()

    def verify(self, signature: str, *parts: str) -> bool:
        return hmac.compare_digest(signature, self.sign(*parts))

    def presign_upload(
        self, key: str, content_type: str, max_bytes: int
    ) -> UploadTarget:
        expires = str(int(time.time()) + URL_TTL_SECONDS)
        fields = {
            "key": key,
            "content_type": content_type,
            "max_bytes": str(max_bytes),
            "expires": expires,
        }
        fields["signature"] = self.sign(
            "upload", key, content_type, str(max_bytes), expires
        )
        return UploadTarget(
            url=f"{self.base_url}/api/files/upload",
            fields=fields,
            key=key,
            expires_at=int(expires),
        )

    def presign_download(self, key: str) -> str:
        expires = str(int(time.time()) + URL_TTL_SECONDS)
        signature = self.sign("download", key, expires)
        return (
            f"{self.base_url}/api/files/{key}?expires={expires}&signature={signature}"
        )

    def path(self, key: str) -> Path:
        if not KEY_RE.fullmatch(key):
            raise ValueError("bad key")
        return self.root / key


@lru_cache(maxsize=1)
def default_storage() -> Storage:
    if settings.storage_backend == "s3":
        return S3Storage(settings.uploads_bucket, settings.aws_region)
    return LocalStorage(
        settings.uploads_dir, settings.files_secret, settings.public_api_url
    )


def get_storage() -> Storage:
    """FastAPI dependency; tests override it with a LocalStorage in a temp dir."""
    return default_storage()
