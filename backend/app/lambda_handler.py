"""AWS Lambda entry point.

- {"action": "migrate"} runs `alembic upgrade head` and reports the head revision.
- Any other "action" is an error, so a typo never falls through to the API.
- Events without "action" are HTTP requests from the function URL (Mangum).
"""

import logging
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from mangum import Mangum

from app.main import app

log = logging.getLogger()
log.setLevel(logging.INFO)

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

_http = Mangum(app, lifespan="off")


def run_migrations() -> dict[str, Any]:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_INI.parent / "migrations"))
    command.upgrade(config, "head")
    head = ScriptDirectory.from_config(config).get_current_head()
    log.info("migrated to %s", head)
    return {"migrated": True, "revision": head}


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if isinstance(event, dict) and "action" in event:
        action = event["action"]
        if action == "migrate":
            return run_migrations()
        raise ValueError(f"unknown action: {action!r}")
    return _http(event, context)
