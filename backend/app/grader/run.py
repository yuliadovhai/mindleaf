"""One grading pass, and the CLI for local runs (`make grade`)."""

import argparse
import logging
import os
import time
from collections.abc import Callable

from app.grader.api_client import ApiClient
from app.grader.graders import DEFAULT_MODEL, BedrockGrader, FakeGrader, Grader

log = logging.getLogger(__name__)


def run(
    api,
    grader: Grader,
    *,
    limit: int = 5,
    time_left: Callable[[], float] = lambda: float("inf"),
    min_seconds: float = 30.0,
) -> dict[str, int]:
    """Claim and grade until nothing is waiting or time runs low.

    Any failure sends that assignment to the tutor instead of retrying, so a
    broken model or prompt can never loop and keep spending money.
    """
    counts = {"graded": 0, "failed": 0}
    while time_left() > min_seconds:
        tasks = api.claim(limit)
        if not tasks:
            break
        for task in tasks:
            try:
                results = grader.grade(task)
                api.post_result(task.assignment_id, grader.model, results)
                counts["graded"] += 1
            except Exception:
                log.exception("grading failed for %s", task.assignment_id)
                api.post_failed(task.assignment_id)
                counts["failed"] += 1
    return counts


def make_grader(kind: str, model: str, region: str) -> Grader:
    if kind == "bedrock":
        return BedrockGrader(model=model, region=region)
    if kind == "fake":
        return FakeGrader()
    raise ValueError(f"unknown grader {kind!r}")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Grade written quiz answers once.")
    parser.add_argument(
        "--api", default=os.environ.get("API_URL", "http://backend:8000")
    )
    parser.add_argument("--grader", default=os.environ.get("GRADER", "fake"))
    parser.add_argument(
        "--model", default=os.environ.get("GRADER_MODEL", DEFAULT_MODEL)
    )
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    api = ApiClient(args.api, os.environ["GRADER_TOKEN"])
    grader = make_grader(
        args.grader, args.model, os.environ.get("AWS_REGION", "us-east-1")
    )
    started = time.monotonic()
    counts = run(api, grader, limit=args.limit)
    print(f"{counts} in {time.monotonic() - started:.1f}s with {args.grader}")


if __name__ == "__main__":
    main()
