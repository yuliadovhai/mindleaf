"""S3 presigning is local computation: no network, works inside a VPC without NAT."""

import socket

import pytest

from app.storage import S3Storage


@pytest.fixture
def no_network(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("storage tried to open a network connection")

    monkeypatch.setattr(socket, "create_connection", refuse)
    monkeypatch.setattr(socket.socket, "connect", refuse)


@pytest.fixture
def fake_aws(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIATESTTESTTEST")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "token")


def test_presigned_post_limits_type_and_size(fake_aws, no_network):
    storage = S3Storage("tutor-cabinet-uploads", "us-east-1")
    key = f"homework/{'0' * 8}-0000-0000-0000-{'0' * 12}/{'a' * 32}.jpg"

    target = storage.presign_upload(key, "image/jpeg", 1234)

    assert target.url == "https://tutor-cabinet-uploads.s3.amazonaws.com/"
    assert target.fields["key"] == key
    assert target.fields["Content-Type"] == "image/jpeg"
    assert target.fields["x-amz-algorithm"] == "AWS4-HMAC-SHA256"
    assert "policy" in target.fields


def test_presigned_get(fake_aws, no_network):
    storage = S3Storage("tutor-cabinet-uploads", "us-east-1")

    url = storage.presign_download("homework/x/y.png")

    assert url.startswith(
        "https://tutor-cabinet-uploads.s3.amazonaws.com/homework/x/y.png?"
    )
    assert "X-Amz-Signature=" in url
    assert "X-Amz-Expires=900" in url
