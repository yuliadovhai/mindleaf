"""Runtime settings read from the environment.

Free of app.db, so the auth code and the Lambda handler can import it without a
database connection.
"""

import logging
import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

_log = logging.getLogger(__name__)


def _parse_promo_codes(raw: str) -> tuple[tuple[str, int, int], ...]:
    result = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(":")
        if len(parts) != 3:
            _log.warning(
                "PROMO_CODES: invalid entry %r (expected CODE:DAYS:MAX_USES), ignoring",
                entry,
            )
            continue
        code_str, days_str, max_uses_str = parts
        try:
            days = int(days_str.strip())
            max_uses = int(max_uses_str.strip())
            if days <= 0 or max_uses <= 0:
                raise ValueError
        except ValueError:
            _log.warning("PROMO_CODES: invalid numbers in %r, ignoring", entry)
            continue
        result.append((code_str.strip().upper(), days, max_uses))
    return tuple(result)


# The product works in one time zone: "today", "this month" and every datetime in
# API responses are in Kyiv time.
TIMEZONE = ZoneInfo("Europe/Kyiv")


def _sqlalchemy_url(url: str) -> str:
    """Hosts such as Render hand out "postgres://" / "postgresql://" URLs; this app
    talks to PostgreSQL through psycopg 3, so name the driver explicitly."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


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
    # LiqPay merchant keys (sandbox_... keys for testing). Without them, billing
    # runs in "demo" mode locally and is disabled in Lambda.
    liqpay_public_key: str
    liqpay_private_key: str
    liqpay_sandbox: bool
    # The site's origin: LiqPay sends the payer back here after checkout.
    site_url: str
    # Telegram reminders. Without a bot token the feature is off (409 on linking).
    telegram_bot_token: str
    telegram_bot_username: str
    # Telegram sends it back in X-Telegram-Bot-Api-Secret-Token on every webhook.
    telegram_webhook_secret: str
    # Shared secret of the scheduler (GitHub Actions) that triggers reminders;
    # empty disables /api/internal/reminders.
    cron_token: str
    in_lambda: bool
    # Tuple of (normalized_code, days, max_uses) parsed from PROMO_CODES env var.
    promo_codes: tuple[tuple[str, int, int], ...]
    # "disabled" forces billing_mode to "disabled" regardless of LiqPay keys.
    billing_mode_env: str | None

    @property
    def billing_mode(self) -> str:
        """ "liqpay", "demo" (local, no keys) or "disabled" (Lambda, no keys)."""
        if self.billing_mode_env == "disabled":
            return "disabled"
        if self.liqpay_public_key and self.liqpay_private_key:
            return "liqpay"
        return "disabled" if self.in_lambda else "demo"

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("CORS_ORIGINS", "")
        return cls(
            database_url=_sqlalchemy_url(os.environ.get("DATABASE_URL", "")),
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
            liqpay_public_key=os.environ.get("LIQPAY_PUBLIC_KEY", ""),
            liqpay_private_key=os.environ.get("LIQPAY_PRIVATE_KEY", ""),
            liqpay_sandbox=os.environ.get("LIQPAY_SANDBOX", "0") == "1",
            site_url=os.environ.get("SITE_URL", "http://localhost:5173").rstrip("/"),
            telegram_bot_token=os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            telegram_bot_username=os.environ.get("TELEGRAM_BOT_USERNAME", "").lstrip(
                "@"
            ),
            telegram_webhook_secret=os.environ.get("TELEGRAM_WEBHOOK_SECRET", ""),
            cron_token=os.environ.get("CRON_TOKEN", ""),
            in_lambda=bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME")),
            promo_codes=_parse_promo_codes(os.environ.get("PROMO_CODES", "")),
            billing_mode_env=os.environ.get("BILLING_MODE") or None,
        )


settings = Settings.from_env()

if settings.dev_auth and os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    # A fake-login switch must never reach AWS, even by a copied variable.
    raise RuntimeError("DEV_AUTH=on is for local development only")
