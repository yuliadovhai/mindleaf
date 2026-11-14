"""LiqPay signing, without any network call.

    data      = base64(JSON of the parameters)
    signature = base64(SHA-1(private_key + data + private_key))   (binary digest)

This is what LiqPay's official SDKs do (API version 3). The current docs text
mentions SHA3-256 for version 7 while their own examples use SHA-1, so incoming
callbacks are accepted with either digest; both need the private key.
"""

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any

CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout"
REQUEST_URL = "https://www.liqpay.ua/api/request"
API_VERSION = 3


class BadSignature(Exception):
    pass


@dataclass(frozen=True)
class Signed:
    data: str
    signature: str


def _digest(private_key: str, data: str, algorithm: str) -> str:
    raw = f"{private_key}{data}{private_key}".encode()
    return base64.b64encode(hashlib.new(algorithm, raw).digest()).decode()


def sign(private_key: str, params: dict[str, Any]) -> Signed:
    data = base64.b64encode(
        json.dumps(params, ensure_ascii=False, separators=(",", ":")).encode()
    ).decode()
    return Signed(data=data, signature=_digest(private_key, data, "sha1"))


def verify(private_key: str, data: str, signature: str) -> dict[str, Any]:
    """The decoded payload, or BadSignature."""
    if not private_key or not data or not signature:
        raise BadSignature("missing data, signature or key")
    for algorithm in ("sha1", "sha3_256"):
        if hmac.compare_digest(_digest(private_key, data, algorithm), signature):
            try:
                return json.loads(base64.b64decode(data))
            except ValueError as exc:
                raise BadSignature("data is not base64 JSON") from exc
    raise BadSignature("signature does not match")
