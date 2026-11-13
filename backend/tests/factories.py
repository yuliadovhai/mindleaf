"""Small helpers that create records through the API."""

from fastapi.testclient import TestClient


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
