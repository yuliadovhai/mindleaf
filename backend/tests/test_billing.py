"""The tutor's plan: Free limits, LiqPay checkout and callbacks, read-only, cancel."""

import base64
import dataclasses
import hashlib
import json
from datetime import timedelta

import pytest

from app.api import billing as billing_api
from app.api.internal import get_grader_token
from app.main import app
from app.models import Subscription
from app.services import billing, clock, liqpay
from tests.factories import (
    answers_for,
    assign_quiz,
    create_lesson,
    create_quiz,
    create_student,
    upload_material,
)

pytestmark = pytest.mark.real_billing

PRIVATE_KEY = "sandbox_private"


@pytest.fixture
def liqpay_mode(monkeypatch):
    """Billing with (fake) LiqPay sandbox keys instead of the local demo."""
    configured = dataclasses.replace(
        billing.settings,
        liqpay_public_key="sandbox_public",
        liqpay_private_key=PRIVATE_KEY,
        liqpay_sandbox=True,
        site_url="https://site.example",
        public_api_url="https://api.example",
    )
    monkeypatch.setattr(billing, "settings", configured)
    monkeypatch.setattr(billing_api, "settings", configured)
    return configured


@pytest.fixture
def tutor(as_tutor, family):
    return as_tutor(family["tutor"])


def callback(client, payload, key=PRIVATE_KEY):
    signed = liqpay.sign(key, payload)
    return client.post(
        "/api/billing/liqpay/callback",
        data={"data": signed.data, "signature": signed.signature},
    )


def start(client, period="month"):
    response = client.post("/api/billing/checkout", json={"period": period})
    assert response.status_code == 200, response.text
    return response.json()


# ---------- signing ----------


def test_signature_is_base64_sha1_of_key_data_key():
    signed = liqpay.sign("priv", {"action": "pay", "amount": "1.00"})

    expected = base64.b64encode(
        hashlib.sha1(f"priv{signed.data}priv".encode()).digest()
    ).decode()
    assert signed.signature == expected
    assert json.loads(base64.b64decode(signed.data)) == {
        "action": "pay",
        "amount": "1.00",
    }
    assert liqpay.verify("priv", signed.data, signed.signature)["action"] == "pay"


def test_sha3_signatures_are_accepted_too():
    data = liqpay.sign("priv", {"status": "success"}).data
    sha3 = base64.b64encode(
        hashlib.sha3_256(f"priv{data}priv".encode()).digest()
    ).decode()

    assert liqpay.verify("priv", data, sha3) == {"status": "success"}


@pytest.mark.parametrize(
    ("key", "tamper"), [("other", False), ("priv", True), ("", False)]
)
def test_bad_signatures_are_rejected(key, tamper):
    signed = liqpay.sign("priv", {"status": "success"})
    signature = signed.signature[::-1] if tamper else signed.signature

    with pytest.raises(liqpay.BadSignature):
        liqpay.verify(key, signed.data, signature)


# ---------- the Free plan ----------


def test_free_plan_state(tutor):
    plan = tutor.get("/api/billing").json()

    assert plan["plan"] == "free"
    assert plan["active_students"] == 2
    assert plan["free_student_limit"] == 3
    assert plan["read_only"] is False
    assert plan["prices"] == {"month": 19900, "year": 199000}
    assert plan["billing_mode"] == "demo"


def test_free_plan_stops_at_three_active_students(tutor, family):
    create_student(tutor, full_name="Третій")

    blocked = tutor.post(
        "/api/students", json={"full_name": "Четвертий", "default_price": 1}
    )
    assert blocked.status_code == 402
    assert blocked.json() == {"detail": "plan_limit"}

    # Archiving frees a place; unarchiving beyond the limit is blocked too.
    tutor.delete(f"/api/students/{family['andrii']['id']}")
    create_student(tutor, full_name="Четвертий")
    back = tutor.patch(
        f"/api/students/{family['andrii']['id']}", json={"archived": False}
    )
    assert back.json() == {"detail": "plan_limit"}


def test_ai_features_need_pro(tutor, as_user, family, storage):
    material = upload_material(tutor)
    generate = tutor.post(f"/api/materials/{material['id']}/generate-quiz", json={})
    assert generate.status_code == 402
    assert generate.json() == {"detail": "pro_required"}

    # On Free, written quiz answers go to the tutor, not to the paid AI grader.
    quiz = create_quiz(tutor)
    assignment = assign_quiz(tutor, quiz["id"], family["olena"]["id"])
    submitted = as_user(family["kid"]).post(
        f"/api/portal/quiz-assignments/{assignment['id']}/submit",
        json=answers_for(quiz, single="1", multiple=["1"], text="відповідь"),
    )
    assert submitted.json()["status"] == "needs_review"


# ---------- LiqPay checkout and callbacks ----------


def test_checkout_form(tutor, liqpay_mode, db):
    form = start(tutor, "year")

    assert form["mode"] == "liqpay"
    assert form["url"] == "https://www.liqpay.ua/api/3/checkout"
    params = liqpay.verify(PRIVATE_KEY, form["data"], form["signature"])
    assert params["action"] == "subscribe"
    assert params["public_key"] == "sandbox_public"
    assert params["amount"] == "1990.00"
    assert params["currency"] == "UAH"
    assert params["subscribe"] == "1"
    assert params["subscribe_periodicity"] == "year"
    assert params["order_id"] == form["order_id"]
    assert params["server_url"] == "https://api.example/api/billing/liqpay/callback"
    assert params["result_url"] == "https://site.example/billing?checkout=done"
    assert params["sandbox"] == "1"
    sub = db.query(Subscription).filter_by(order_id=form["order_id"]).one()
    assert (sub.status, sub.paid_until) == ("pending", None)


def test_paid_callback_grants_pro_once(tutor, liqpay_mode, db_client):
    order = start(tutor)["order_id"]
    first = {
        "order_id": order,
        "action": "subscribe",
        "status": "subscribed",
        "payment_id": 1,
    }

    assert callback(db_client, first).status_code == 200
    plan = tutor.get("/api/billing").json()
    assert (plan["plan"], plan["subscription_status"], plan["period"]) == (
        "pro",
        "active",
        "month",
    )
    paid_until = plan["pro_until"]
    # The same payment again, or reported as "success": no second month.
    callback(db_client, first)
    callback(db_client, {**first, "status": "success"})
    assert tutor.get("/api/billing").json()["pro_until"] == paid_until
    # The next month's charge extends it.
    callback(
        db_client, {**first, "action": "regular", "status": "success", "payment_id": 2}
    )
    assert tutor.get("/api/billing").json()["pro_until"] > paid_until


def test_sandbox_status_counts_as_paid_in_sandbox_mode(tutor, liqpay_mode, db_client):
    order = start(tutor)["order_id"]

    callback(db_client, {"order_id": order, "status": "sandbox", "payment_id": 7})

    assert tutor.get("/api/billing").json()["plan"] == "pro"


@pytest.mark.parametrize("status", ["failure", "error", "reversed", "wait_secure"])
def test_unpaid_statuses_grant_nothing(tutor, liqpay_mode, db_client, status):
    order = start(tutor)["order_id"]

    assert (
        callback(
            db_client, {"order_id": order, "status": status, "payment_id": 3}
        ).status_code
        == 200
    )

    assert tutor.get("/api/billing").json()["plan"] == "free"


def test_bad_signature_and_unknown_order(tutor, liqpay_mode, db_client):
    order = start(tutor)["order_id"]

    forged = callback(db_client, {"order_id": order, "status": "success"}, key="guess")
    assert forged.status_code == 400
    assert tutor.get("/api/billing").json()["plan"] == "free"
    unknown = callback(
        db_client, {"order_id": "tc-nope", "status": "success", "payment_id": 9}
    )
    assert unknown.status_code == 200


def test_already_subscribed(tutor, liqpay_mode, db_client):
    order = start(tutor)["order_id"]
    callback(db_client, {"order_id": order, "status": "subscribed", "payment_id": 1})

    again = tutor.post("/api/billing/checkout", json={"period": "month"})

    assert again.status_code == 409
    assert again.json() == {"detail": "already_subscribed"}


# ---------- read-only after Pro, over the Free limit ----------


def test_read_only_when_pro_ran_out_over_the_limit(tutor, family, db, monkeypatch):
    db.add(
        Subscription(
            tutor_id=family["tutor"].id,
            order_id="tc-old",
            period="month",
            amount=19900,
            status="cancelled",
            paid_until=clock.now() + timedelta(days=1),
        )
    )
    db.flush()
    for name in ("Третій", "Четвертий"):
        create_student(tutor, full_name=name)  # allowed while Pro lasts
    later = clock.now() + timedelta(days=1) + billing.GRACE + timedelta(minutes=1)
    monkeypatch.setattr(clock, "now", lambda: later)

    plan = tutor.get("/api/billing").json()
    assert (plan["plan"], plan["read_only"], plan["active_students"]) == (
        "free",
        True,
        4,
    )
    olena = family["olena"]["id"]
    blocked = tutor.post(
        "/api/lessons",
        json={"student_id": olena, "starts_at": "2026-12-01T10:00:00+02:00"},
    )
    assert blocked.status_code == 402
    assert blocked.json() == {"detail": "plan_read_only"}
    assert tutor.patch(f"/api/students/{olena}", json={"notes": "x"}).status_code == 402
    # Looking is fine; archiving is how to get back under the limit.
    assert tutor.get("/api/students").status_code == 200
    assert tutor.get("/api/dashboard").status_code == 200
    assert tutor.delete(f"/api/students/{family['andrii']['id']}").status_code == 204
    assert tutor.get("/api/billing").json()["read_only"] is False
    assert create_lesson(tutor, olena)["status"] == "planned"


def test_grace_period_keeps_pro(tutor, family, db, monkeypatch):
    paid_until = clock.now()
    db.add(
        Subscription(
            tutor_id=family["tutor"].id,
            order_id="tc-grace",
            period="month",
            amount=19900,
            status="active",
            paid_until=paid_until,
        )
    )
    db.flush()
    monkeypatch.setattr(
        clock, "now", lambda: paid_until + billing.GRACE - timedelta(hours=1)
    )

    assert tutor.get("/api/billing").json()["plan"] == "pro"


# ---------- demo mode (local, no keys) ----------


def test_demo_checkout_and_payment(tutor):
    form = start(tutor)
    assert form["mode"] == "demo"
    assert form["url"].endswith("/billing/demo-checkout")

    paid = tutor.post("/api/billing/demo/pay", json={"order_id": form["order_id"]})

    assert paid.status_code == 200
    assert paid.json()["plan"] == "pro"


def test_demo_pay_is_off_with_real_keys(tutor, liqpay_mode):
    order = start(tutor)["order_id"]

    assert (
        tutor.post("/api/billing/demo/pay", json={"order_id": order}).status_code == 404
    )


# ---------- cancelling ----------


def test_cancel_in_demo_mode_keeps_paid_time(tutor):
    form = start(tutor)
    tutor.post("/api/billing/demo/pay", json={"order_id": form["order_id"]})

    plan = tutor.post("/api/billing/cancel").json()

    assert (plan["plan"], plan["subscription_status"]) == ("pro", "cancelled")
    assert tutor.post("/api/billing/cancel").json() == {
        "detail": "no_active_subscription"
    }


def test_cancel_with_liqpay_goes_through_the_worker(tutor, liqpay_mode, db_client):
    app.dependency_overrides[get_grader_token] = lambda: "token"
    headers = {"X-Grader-Token": "token"}
    order = start(tutor)["order_id"]
    callback(db_client, {"order_id": order, "status": "subscribed", "payment_id": 1})

    pending = tutor.post("/api/billing/cancel").json()
    assert (pending["subscription_status"], pending["cancel_pending"]) == (
        "active",
        True,
    )

    tasks = db_client.post("/api/internal/billing/claim", headers=headers).json()
    assert len(tasks) == 1
    task = tasks[0]
    assert task["request_url"] == "https://www.liqpay.ua/api/request"
    request = liqpay.verify(PRIVATE_KEY, task["data"], task["signature"])
    assert (request["action"], request["order_id"]) == ("unsubscribe", order)
    assert db_client.post("/api/internal/billing/claim", headers=headers).json() == []

    db_client.post(
        f"/api/internal/billing/{task['subscription_id']}/result",
        json={"status": "unsubscribed"},
        headers=headers,
    )
    done = tutor.get("/api/billing").json()
    assert (done["plan"], done["subscription_status"], done["cancel_pending"]) == (
        "pro",
        "cancelled",
        False,
    )


# ---------- who may do what ----------


def test_isolation_and_roles(tutor, as_tutor, as_user, tutor_b, family):
    order = start(tutor)["order_id"]
    b = as_tutor(tutor_b)

    assert b.get("/api/billing").json()["plan"] == "free"
    assert b.post("/api/billing/demo/pay", json={"order_id": order}).status_code == 404
    assert as_tutor(family["tutor"]).get("/api/billing").json()["plan"] == "free"
    assert as_user(family["mom"]).get("/api/billing").status_code == 403
    assert (
        as_user(family["mom"])
        .post("/api/billing/checkout", json={"period": "month"})
        .status_code
        == 403
    )


class FakeWorkerApi:
    """The worker's ApiClient for billing, with LiqPay stubbed out."""

    def __init__(self, client, liqpay_answer):
        self.client = client
        self.answer = liqpay_answer
        self.forwarded = []

    def claim_cancellations(self, limit=5):
        return self.client.post(
            "/api/internal/billing/claim", headers={"X-Grader-Token": "token"}
        ).json()

    def forward_to_liqpay(self, url, data, signature):
        self.forwarded.append((url, data, signature))
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer

    def post_cancel_result(self, subscription_id, status):
        return self.client.post(
            f"/api/internal/billing/{subscription_id}/result",
            json={"status": status},
            headers={"X-Grader-Token": "token"},
        ).json()


@pytest.mark.parametrize(
    ("answer", "expected", "final_status"),
    [
        ({"status": "unsubscribed", "result": "ok"}, "unsubscribed", "cancelled"),
        ({"status": "error", "result": "error"}, "unsubscribe_failed", "active"),
        (OSError("network down"), "unsubscribe_failed", "active"),
    ],
)
def test_worker_forwards_unsubscribe(
    tutor, liqpay_mode, db_client, answer, expected, final_status
):
    from app.grader.run import run_billing

    app.dependency_overrides[get_grader_token] = lambda: "token"
    order = start(tutor)["order_id"]
    callback(db_client, {"order_id": order, "status": "subscribed", "payment_id": 1})
    tutor.post("/api/billing/cancel")
    api = FakeWorkerApi(db_client, answer)

    counts = run_billing(api)

    assert counts[expected] == 1
    assert api.forwarded[0][0] == "https://www.liqpay.ua/api/request"
    assert tutor.get("/api/billing").json()["subscription_status"] == final_status
