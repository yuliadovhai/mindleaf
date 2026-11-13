"""Runtime settings read from the environment.

Free of app.db, so the auth code and the Lambda handler can import it without a
database connection.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    cognito_authority: str
    cognito_client_id: str
    cognito_jwks: str | None
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("CORS_ORIGINS", "")
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            cognito_authority=os.environ.get("COGNITO_AUTHORITY", "").rstrip("/"),
            cognito_client_id=os.environ.get("COGNITO_CLIENT_ID", ""),
            cognito_jwks=os.environ.get("COGNITO_JWKS") or None,
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        )


settings = Settings.from_env()
