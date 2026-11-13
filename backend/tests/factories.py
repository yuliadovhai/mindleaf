"""Small helpers that create records through the API."""

from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.settings import TIMEZONE

# Friday 13 November 2026, 12:00 in Kyiv: the frozen "now" of the portal tests.
NOW = datetime(2026, 11, 13, 12, 0, tzinfo=TIMEZONE)


def iso(delta: timedelta) -> str:
    return (NOW + delta).isoformat()


def create_student(client: TestClient, **fields) -> dict:
    body = {"full_name": "Олена Коваль", "default_price": 50000, **fields}
    response = client.post("/api/students", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def create_lesson(client: TestClient, student_id: str, **fields) -> dict:
    body = {
        "student_id": student_id,
        "starts_at": "2026-11-13T16:00:00+02:00",
        **fields,
    }
    response = client.post("/api/lessons", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def create_payment(client: TestClient, student_id: str, **fields) -> dict:
    body = {"student_id": student_id, "amount": 50000, "method": "cash", **fields}
    response = client.post("/api/payments", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def create_invite(client: TestClient, student_id: str, relation: str) -> dict:
    response = client.post(
        f"/api/students/{student_id}/invites", json={"relation": relation}
    )
    assert response.status_code == 201, response.text
    return response.json()


def redeem(client: TestClient, code: str):
    return client.post("/api/invites/redeem", json={"code": code})
