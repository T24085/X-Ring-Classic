from __future__ import annotations

from pathlib import Path
from typing import Optional

from ollama_network.models import ExecutorResult
from ollama_network.service import NetworkService
from ollama_network.state_store import LocalStateStore


class FakeExecutor:
    def __init__(self, output_tokens: int, success: bool = True, verified: bool = True) -> None:
        self.output_tokens = output_tokens
        self.success = success
        self.verified = verified

    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        return ExecutorResult(
            success=self.success,
            output_text=f"done:{model_tag}",
            output_tokens=self.output_tokens,
            latency_seconds=0.01,
            verified=self.verified,
            error_message="",
        )


def _build_service(tmp_path, *, executor_tokens: int = 48, admin_emails: Optional[set[str]] = None) -> NetworkService:
    return NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor(output_tokens=executor_tokens),
        state_store=LocalStateStore(Path(tmp_path) / "private_state.json"),
        admin_emails=admin_emails,
    )


def _register_worker(service: NetworkService, worker_user_id: str, model_tag: str = "glm4:9b") -> None:
    service.register_worker(
        {
            "worker_id": "worker-1",
            "owner_user_id": worker_user_id,
            "gpu_name": "RTX 4090",
            "vram_gb": 24,
            "installed_models": [model_tag],
            "benchmark_tokens_per_second": {model_tag: 72},
            "runtime": "ollama",
            "allows_cloud_fallback": False,
        },
        actor_user_id=worker_user_id,
    )


def test_credit_purchase_uses_public_conversion_rate(tmp_path) -> None:
    service = _build_service(tmp_path)

    service.register_user("buyer")
    purchased = service.purchase_credits(usd_amount=10, actor_user_id="buyer")

    assert purchased["credits_added"] == 1000
    assert purchased["wallet"]["available_credits"] == 1000
    ledger = service.get_ledger("buyer")["entries"]
    assert ledger[-1]["entry_type"] == "purchase"
    assert ledger[-1]["amount"] == 1000


def test_job_settlement_matches_credit_spec_and_clears_pending_hold(tmp_path) -> None:
    service = _build_service(tmp_path, executor_tokens=1000)

    service.register_user("requester")
    service.register_user("worker_owner")
    service.coordinator.ledger.adjust("requester", amount=500, source="test_setup")
    _register_worker(service, "worker_owner")

    created = service.submit_job(
        {
            "requester_user_id": "requester",
            "model_tag": "glm4:9b",
            "prompt": "hello",
            "prompt_tokens": 4500,
            "max_output_tokens": 1000,
        },
        actor_user_id="requester",
    )
    completed = service.run_worker_cycle("worker-1", executor=FakeExecutor(output_tokens=1000))

    assert created["reserved_credits"] == 9
    assert completed["actual_credits"] == 9
    assert completed["refunded_credits"] == 0
    assert completed["worker_earned_credits"] == 6
    assert completed["platform_fee_credits"] == 3

    requester_wallet = service.get_wallet("requester")
    worker_wallet = service.get_wallet("worker_owner")
    platform_wallet = service.coordinator.ledger.wallet_snapshot("platform_treasury")

    assert requester_wallet["available_credits"] == 491
    assert requester_wallet["pending_credits"] == 0
    assert requester_wallet["spent_credits"] == 9
    assert worker_wallet["available_credits"] == 6
    assert worker_wallet["earned_credits"] == 6
    assert platform_wallet["available_credits"] == 3
    assert platform_wallet["earned_credits"] == 3

    requester_ledger = service.get_ledger("requester")["entries"]
    assert [entry["entry_type"] for entry in requester_ledger] == ["adjustment", "spend"]
    assert requester_ledger[-1]["source"] == "job_execution"
    assert requester_ledger[-1]["amount"] == -9


def test_job_refund_returns_unused_reserved_credits(tmp_path) -> None:
    service = _build_service(tmp_path, executor_tokens=100)

    service.register_user("requester")
    service.register_user("worker_owner")
    service.coordinator.ledger.adjust("requester", amount=100, source="test_setup")
    _register_worker(service, "worker_owner")

    created = service.submit_job(
        {
            "requester_user_id": "requester",
            "model_tag": "glm4:9b",
            "prompt": "hello",
            "prompt_tokens": 4500,
            "max_output_tokens": 5000,
        },
        actor_user_id="requester",
    )
    completed = service.run_worker_cycle("worker-1", executor=FakeExecutor(output_tokens=100))

    assert created["reserved_credits"] == 15
    assert completed["actual_credits"] == 8
    assert completed["refunded_credits"] == 7
    assert completed["worker_earned_credits"] == 5
    assert completed["platform_fee_credits"] == 3

    requester_wallet = service.get_wallet("requester")
    assert requester_wallet["available_credits"] == 92
    assert requester_wallet["spent_credits"] == 8

    requester_ledger = service.get_ledger("requester")["entries"]
    assert [entry["entry_type"] for entry in requester_ledger] == ["adjustment", "spend", "refund"]
    assert requester_ledger[-1]["amount"] == 7
    assert requester_ledger[-1]["source"] == "unused_reserved_credits"


def test_actual_prompt_and_output_tokens_drive_billing_snapshot(tmp_path) -> None:
    service = _build_service(tmp_path, executor_tokens=10)

    service.register_user("requester")
    service.register_user("worker_owner")
    service.coordinator.ledger.adjust("requester", amount=50, source="test_setup")
    _register_worker(service, "worker_owner")

    created = service.submit_job(
        {
            "requester_user_id": "requester",
            "model_tag": "glm4:9b",
            "prompt": "hello",
            "prompt_tokens": 999,
            "max_output_tokens": 200,
        },
        actor_user_id="requester",
    )
    assignment = service.claim_job_for_worker("worker-1")
    assert assignment is not None
    completed = service.complete_job(
        {
            "job_id": created["job_id"],
            "worker_id": "worker-1",
            "success": True,
            "output_tokens": 120,
            "prompt_tokens_used": 880,
            "latency_seconds": 0.01,
            "verified": True,
            "output_text": "done",
        }
    )

    assert completed["prompt_tokens_used"] == 880
    assert completed["output_tokens_used"] == 120
    assert completed["billed_tokens"] == 1000
    assert completed["actual_credits"] == 2


def test_admin_self_serve_job_refunds_requester_without_charging(tmp_path) -> None:
    service = _build_service(tmp_path, executor_tokens=100, admin_emails={"admin@example.com"})

    session = service.get_authenticated_session(
        {"uid": "firebase-admin-1", "email": "admin@example.com", "name": "Admin User"}
    )
    _register_worker(service, session["user_id"])

    created = service.submit_job(
        {
            "requester_user_id": session["user_id"],
            "model_tag": "glm4:9b",
            "prompt": "hello",
            "prompt_tokens": 1000,
            "max_output_tokens": 1000,
        },
        actor_user_id=session["user_id"],
    )
    completed = service.run_worker_cycle(
        "worker-1",
        executor=FakeExecutor(output_tokens=100),
        actor_email="admin@example.com",
        allow_admin_self_serve=True,
    )

    assert created["reserved_credits"] == 3
    assert completed["actual_credits"] == 0
    assert completed["refunded_credits"] == 3
    assert completed["worker_earned_credits"] == 0
    assert completed["platform_fee_credits"] == 0

    wallet = service.get_wallet(session["user_id"])
    assert wallet["available_credits"] == 5
    assert wallet["spent_credits"] == 0
    assert wallet["pending_credits"] == 0

    ledger = service.get_ledger(session["user_id"])["entries"]
    assert [entry["entry_type"] for entry in ledger] == ["adjustment", "refund"]
    assert ledger[0]["amount"] == 5
    assert ledger[0]["source"] == "bootstrap_credits"
    assert ledger[1]["amount"] == 3
    assert ledger[1]["source"] == "self_served_refund"
