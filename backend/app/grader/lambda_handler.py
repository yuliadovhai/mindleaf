"""Entry point of the grader Lambda (outside the VPC).

Invoked every minute by EventBridge Scheduler (and may be invoked right after
a quiz is submitted or a generation is requested). Each run grades written
quiz answers, then turns queued materials into draft quizzes.

Environment: API_URL, GRADER_TOKEN, GRADER (bedrock | fake | off),
GRADER_MODEL, AWS_REGION.
"""

import logging
import os

from app.grader.api_client import ApiClient
from app.grader.graders import DEFAULT_MODEL
from app.grader.run import make_generator, make_grader, run, run_generation

logging.getLogger().setLevel(logging.INFO)


def handler(event, context) -> dict:
    kind = os.environ.get("GRADER", "bedrock")
    if kind == "off":
        return {"graded": 0, "failed": 0, "grader": "off"}
    api = ApiClient(os.environ["API_URL"], os.environ["GRADER_TOKEN"])
    model = os.environ.get("GRADER_MODEL", DEFAULT_MODEL)
    region = os.environ.get("AWS_REGION", "us-east-1")

    def time_left() -> float:
        return context.get_remaining_time_in_millis() / 1000

    counts = run(api, make_grader(kind, model, region), time_left=time_left)
    counts |= run_generation(
        api, make_generator(kind, model, region), time_left=time_left
    )
    return {**counts, "grader": kind}
