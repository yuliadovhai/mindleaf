"""Entry point of the grader Lambda (outside the VPC).

Invoked every minute by EventBridge Scheduler, and may also be invoked right
after a quiz is submitted. Environment: API_URL, GRADER_TOKEN, GRADER
(bedrock | fake | off), GRADER_MODEL, AWS_REGION.
"""

import logging
import os

from app.grader.api_client import ApiClient
from app.grader.graders import DEFAULT_MODEL
from app.grader.run import make_grader, run

logging.getLogger().setLevel(logging.INFO)


def handler(event, context) -> dict:
    kind = os.environ.get("GRADER", "bedrock")
    if kind == "off":
        return {"graded": 0, "failed": 0, "grader": "off"}
    api = ApiClient(os.environ["API_URL"], os.environ["GRADER_TOKEN"])
    grader = make_grader(
        kind,
        os.environ.get("GRADER_MODEL", DEFAULT_MODEL),
        os.environ.get("AWS_REGION", "us-east-1"),
    )
    counts = run(
        api,
        grader,
        time_left=lambda: context.get_remaining_time_in_millis() / 1000,
    )
    return {**counts, "grader": kind}
