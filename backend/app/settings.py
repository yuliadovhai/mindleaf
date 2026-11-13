"""Runtime settings read from the environment.

Free of app.db, so the auth code and the Lambda handler can import it without a
database connection.
"""

import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

# The product works in one time zone: "today", "this month" and every datetime in
# API responses are in Kyiv time.
TIMEZONE = ZoneInfo("Europe/Kyiv")


@dataclass(frozen=True)
class Settings:
    database_url: str
    cognito_authority: str
    cognito_client_id: str
    cognito_jwks: str | None
    cors_origins: tuple[str, ...]
    # Homework photos: "s3" in AWS (presigned URLs, signed locally, no network
    # needed), "local" for docker compose (files on a volume, served by the API).
    storage_backend: str
    uploads_bucket: str
    uploads_dir: str
    files_secret: str
    public_api_url: str
    aws_region: str
    # Shared secret of the grader Lambda; empty disables /api/internal.
    grader_token: str
    # "on": written answers wait for the grader; "off": they go to the tutor.
    ai_grader: str
    # Local demo only: accept "Bearer dev:<sub>" without Cognito. Refused in Lambda.
    dev_auth: bool

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("CORS_ORIGINS", "")
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            cognito_authority=os.environ.get("COGNITO_AUTHORITY", "").rstrip("/"),
            cognito_client_id=os.environ.get("COGNITO_CLIENT_ID", ""),
            cognito_jwks=os.environ.get("COGNITO_JWKS") or None,
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
            storage_backend=os.environ.get("STORAGE_BACKEND", "local"),
            uploads_bucket=os.environ.get("UPLOADS_BUCKET", ""),
            uploads_dir=os.environ.get("UPLOADS_DIR", "/data/uploads"),
            files_secret=os.environ.get("FILES_SECRET", ""),
            public_api_url=os.environ.get(
                "PUBLIC_API_URL", "http://localhost:8000"
            ).rstrip("/"),
            aws_region=os.environ.get("AWS_REGION", "us-east-1"),
            grader_token=os.environ.get("GRADER_TOKEN", ""),
            ai_grader=os.environ.get("AI_GRADER", "on"),
            dev_auth=os.environ.get("DEV_AUTH", "off") == "on",
        )


settings = Settings.from_env()

if settings.dev_auth and os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    # A fake-login switch must never reach AWS, even by a copied variable.
    raise RuntimeError("DEV_AUTH=on is for local development only")
