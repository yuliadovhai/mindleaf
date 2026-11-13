"""HTTP client for /api/internal/grading (standard library only)."""

import json
import urllib.request

from app.grader.tasks import GeneratedQuiz, GenerationTask, GradingTask, QuestionResult


class ApiClient:
    def __init__(self, base_url: str, token: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _post(self, path: str, body: dict | None = None, *, area: str = "grading"):
        request = urllib.request.Request(
            f"{self.base_url}/api/internal/{area}{path}",
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

    # ---------- quiz generation ----------

    def claim_generation(self, limit: int) -> list[GenerationTask]:
        tasks = self._post(f"/claim?limit={limit}", area="generation")
        return [GenerationTask(**task) for task in tasks]

    def post_generation(self, job_id: str, model: str, quiz: GeneratedQuiz) -> dict:
        body = {"model": model, "quiz": quiz.model_dump(exclude_none=True)}
        return self._post(f"/{job_id}/result", body, area="generation")

    def post_generation_failed(self, job_id: str, reason: str) -> dict:
        return self._post(
            f"/{job_id}/failed", {"reason": reason[:200]}, area="generation"
        )

    def download(self, url: str, max_bytes: int = 10 * 1024 * 1024) -> bytes:
        """The material, from S3 or the local API (a signed link, no token)."""
        with urllib.request.urlopen(url, timeout=self.timeout) as response:
            data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError("material is larger than 10 MB")
        return data
