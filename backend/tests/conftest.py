"""Test settings are set before anything from `app` is imported."""

import os

os.environ.setdefault("COGNITO_AUTHORITY", "https://cognito.test/us-east-1_TEST")
os.environ.setdefault("COGNITO_CLIENT_ID", "test-client")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
