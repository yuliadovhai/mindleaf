"""One grading pass, and the CLI for local runs (`make grade`)."""

import argparse
import logging
import os
import time
from collections.abc import Callable

from app.grader.api_client import ApiClient
from app.grader.generators import BedrockGenerator, FakeGenerator, Generator
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


def run_generation(
    api,
    generator: Generator,
    *,
    limit: int = 2,
    time_left: Callable[[], float] = lambda: float("inf"),
    min_seconds: float = 60.0,
) -> dict[str, int]:
    """Claim and generate draft quizzes; failures are reported, never retried."""
    counts = {"generated": 0, "generation_failed": 0}
    while time_left() > min_seconds:
        tasks = api.claim_generation(limit)
        if not tasks:
            break
        for task in tasks:
            try:
                material = api.download(task.download_url)
                quiz = generator.generate(task, material)
                api.post_generation(task.job_id, generator.model, quiz)
                counts["generated"] += 1
            except Exception as exc:
                log.exception("generation failed for %s", task.job_id)
                try:
                    api.post_generation_failed(task.job_id, type(exc).__name__)
                except Exception:
                    log.exception("could not report the failure of %s", task.job_id)
                counts["generation_failed"] += 1
    return counts


def make_generator(kind: str, model: str, region: str) -> Generator:
    if kind == "bedrock":
        return BedrockGenerator(model=model, region=region)
    if kind == "fake":
        return FakeGenerator()
    raise ValueError(f"unknown generator {kind!r}")


def make_grader(kind: str, model: str, region: str) -> Grader:
    if kind == "bedrock":
        return BedrockGrader(model=model, region=region)
    if kind == "fake":
        return FakeGrader()
    raise ValueError(f"unknown grader {kind!r}")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(
        description="One pass of the AI worker: grade answers, generate quizzes."
    )
    parser.add_argument(
        "--api", default=os.environ.get("API_URL", "http://backend:8000")
    )
    parser.add_argument("--grader", default=os.environ.get("GRADER", "fake"))
    parser.add_argument(
        "--model", default=os.environ.get("GRADER_MODEL", DEFAULT_MODEL)
    )
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    region = os.environ.get("AWS_REGION", "us-east-1")
    api = ApiClient(args.api, os.environ["GRADER_TOKEN"])
    started = time.monotonic()
    counts = run(api, make_grader(args.grader, args.model, region), limit=args.limit)
    counts |= run_generation(api, make_generator(args.grader, args.model, region))
    print(f"{counts} in {time.monotonic() - started:.1f}s with {args.grader}")


if __name__ == "__main__":
    main()
