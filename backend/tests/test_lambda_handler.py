"""app.lambda_handler: the migrate action and HTTP events through Mangum."""

import json

import pytest

from app import lambda_handler


def function_url_event(method: str, path: str, headers: dict | None = None) -> dict:
    """A Lambda function URL request (payload format 2.0)."""
    return {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "abc.lambda-url.us-east-1.on.aws", **(headers or {})},
        "requestContext": {
            "accountId": "anonymous",
            "apiId": "abc",
            "domainName": "abc.lambda-url.us-east-1.on.aws",
            "domainPrefix": "abc",
            "http": {
                "method": method,
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "203.0.113.1",
                "userAgent": "pytest",
            },
            "requestId": "req-1",
            "routeKey": "$default",
            "stage": "$default",
            "time": "13/Nov/2026:10:00:00 +0000",
            "timeEpoch": 1794564000000,
        },
        "isBase64Encoded": False,
    }


def test_migrate_runs_alembic_upgrade_head(monkeypatch):
    calls = []
    monkeypatch.setattr(
        lambda_handler.command,
        "upgrade",
        lambda config, target: calls.append(
            (config.get_main_option("script_location"), target)
        ),
    )

    result = lambda_handler.handler({"action": "migrate"}, None)

    assert result == {"migrated": True, "revision": "0001"}
    assert len(calls) == 1
    script_location, target = calls[0]
    assert target == "head"
    assert script_location.endswith("/migrations")


def test_unknown_action_fails():
    with pytest.raises(ValueError, match="unknown action"):
        lambda_handler.handler({"action": "migrat"}, None)


def test_http_event_goes_to_fastapi():
    response = lambda_handler.handler(function_url_event("GET", "/api/health"), None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {"status": "ok"}


def test_http_event_without_token_is_401():
    response = lambda_handler.handler(function_url_event("GET", "/api/me"), None)

    assert response["statusCode"] == 401
    assert json.loads(response["body"]) == {"detail": "invalid or missing token"}
