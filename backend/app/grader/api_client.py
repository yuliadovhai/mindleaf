"""HTTP client for /api/internal/grading (standard library only)."""

import json
import urllib.request

from app.grader.tasks import GradingTask, QuestionResult


class ApiClient:
    def __init__(self, base_url: str, token: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _post(self, path: str, body: dict | None = None):
        request = urllib.request.Request(
            f"{self.base_url}/api/internal/grading{path}",
            data=json.dumps(body or {}).encode(),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Grader-Token": self.token,
            },
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

    def claim(self, limit: int) -> list[GradingTask]:
        return [GradingTask(**task) for task in self._post(f"/claim?limit={limit}")]

    def post_result(
        self, assignment_id: str, model: str, results: list[QuestionResult]
    ) -> dict:
        return self._post(
            f"/{assignment_id}/result",
            {"model": model, "results": [r.model_dump() for r in results]},
        )

    def post_failed(self, assignment_id: str) -> dict:
        return self._post(f"/{assignment_id}/failed")
