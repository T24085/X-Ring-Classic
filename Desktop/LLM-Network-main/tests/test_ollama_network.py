from __future__ import annotations

import pytest

from ollama_network.coordinator import OllamaNetworkCoordinator
from ollama_network.models import JobResult, JobStatus, PolicyError, WorkerNode


def make_worker(
    worker_id: str,
    owner_user_id: str,
    model_tag: str = "llama3.1:8b",
    vram_gb: float = 24.0,
    system_ram_gb: float = 32.0,
    tokens_per_second: float = 60.0,
    allows_cloud_fallback: bool = False,
) -> WorkerNode:
    return WorkerNode(
        worker_id=worker_id,
        owner_user_id=owner_user_id,
        gpu_name="RTX 4090",
        vram_gb=vram_gb,
        installed_models={model_tag},
        benchmark_tokens_per_second={model_tag: tokens_per_second},
        system_ram_gb=system_ram_gb,
        reliability_score=0.97,
        allows_cloud_fallback=allows_cloud_fallback,
    )


def make_multi_model_worker(
    worker_id: str,
    owner_user_id: str,
    installed_models: dict[str, float],
    vram_gb: float = 24.0,
    system_ram_gb: float = 32.0,
) -> WorkerNode:
    return WorkerNode(
        worker_id=worker_id,
        owner_user_id=owner_user_id,
        gpu_name="RTX 4090",
        vram_gb=vram_gb,
        installed_models=set(installed_models.keys()),
        benchmark_tokens_per_second=installed_models,
        system_ram_gb=system_ram_gb,
        reliability_score=0.97,
    )


def test_rejects_unknown_or_non_local_models() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=5.0)

    with pytest.raises(PolicyError):
        coordinator.submit_job(
            requester_user_id="alice",
            model_tag="gpt-4.1",
            prompt="hello",
            max_output_tokens=100,
        )

    with pytest.raises(PolicyError):
        coordinator.register_worker(
            make_worker(
                worker_id="worker-cloud",
                owner_user_id="bob",
                allows_cloud_fallback=True,
            )
        )


def test_routes_public_job_to_other_owner_and_transfers_credits() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=8.0)
    coordinator.register_user("bob")
    coordinator.register_worker(make_worker(worker_id="worker-bob", owner_user_id="bob"))

    record = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="llama3.1:8b",
        prompt="Summarize this architecture decision.",
        max_output_tokens=600,
        prompt_tokens=24,
    )
    assignment = coordinator.assign_next_job()

    assert assignment is not None
    assert assignment.worker_id == "worker-bob"
    completed = coordinator.complete_job(
        JobResult(
            job_id=record.request.job_id,
            worker_id="worker-bob",
            success=True,
            verified=True,
            output_tokens=300,
            latency_seconds=4.2,
            output_text="Summary",
        )
    )

    assert completed.actual_credits > 0
    assert completed.worker_earned_credits > 0
    assert completed.platform_fee_credits >= 0
    assert coordinator.ledger.balance_of("bob") == completed.worker_earned_credits
    assert coordinator.ledger.balance_of("alice") == 8 - completed.actual_credits


def test_unverified_jobs_refund_the_requester() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=4.0)
    coordinator.register_worker(make_worker(worker_id="worker-bob", owner_user_id="bob"))

    record = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="llama3.1:8b",
        prompt="Write a checklist.",
        max_output_tokens=250,
        prompt_tokens=12,
    )
    assignment = coordinator.assign_next_job()

    assert assignment is not None
    coordinator.complete_job(
        JobResult(
            job_id=record.request.job_id,
            worker_id="worker-bob",
            success=True,
            verified=False,
            output_tokens=200,
            latency_seconds=2.1,
            output_text="Checklist",
        )
    )

    assert coordinator.ledger.balance_of("alice") == 4
    assert coordinator.ledger.balance_of("bob") == 0


def test_self_owned_workers_do_not_receive_public_pool_jobs() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=4.0)
    coordinator.register_worker(make_worker(worker_id="worker-alice", owner_user_id="alice"))

    coordinator.submit_job(
        requester_user_id="alice",
        model_tag="llama3.1:8b",
        prompt="Draft a changelog.",
        max_output_tokens=200,
    )

    assert coordinator.assign_next_job() is None


def test_admin_override_allows_worker_to_claim_own_queued_job() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=4.0)
    coordinator.register_worker(make_worker(worker_id="worker-alice", owner_user_id="alice"))

    record = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="llama3.1:8b",
        prompt="Draft a changelog.",
        max_output_tokens=200,
    )

    assignment = coordinator.claim_job_for_worker("worker-alice", allow_own_jobs=True)

    assert assignment is not None
    assert assignment.job_id == record.request.job_id

    completed = coordinator.complete_job(
        JobResult(
            job_id=record.request.job_id,
            worker_id="worker-alice",
            success=True,
            verified=True,
            output_tokens=64,
            latency_seconds=0.5,
            output_text="admin preview",
        )
    )

    assert completed.status is JobStatus.COMPLETED
    assert completed.result is not None
    assert completed.result.output_text == "admin preview"
    assert completed.refunded_credits == completed.reserved_credits
    assert coordinator.ledger.balance_of("alice") == 4


def test_auto_selector_prefers_balanced_installed_worker_model() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=10.0)
    coordinator.register_user("bob")
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-bob",
            owner_user_id="bob",
            installed_models={
                "qwen3:4b": 72.0,
                "glm4:9b": 48.0,
                "deepseek-r1:8b": 52.0,
            },
        )
    )

    record = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="auto",
        prompt="Pick the best balanced local model for default routing.",
        max_output_tokens=220,
        prompt_tokens=20,
    )
    assignment = coordinator.assign_next_job()

    assert assignment is not None
    assert assignment.model_tag == "glm4:9b"
    assert coordinator.job_snapshot(record.request.job_id)["resolved_model_tag"] == "glm4:9b"


def test_worker_with_insufficient_system_ram_is_not_selected_for_heavier_model() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=10.0)
    coordinator.register_user("bob")
    coordinator.register_user("carol")
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-low",
            owner_user_id="bob",
            installed_models={"qwen3:14b": 42.0},
            vram_gb=16.0,
            system_ram_gb=10.0,
        )
    )
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-high",
            owner_user_id="carol",
            installed_models={"qwen3:14b": 42.0},
            vram_gb=16.0,
            system_ram_gb=48.0,
        )
    )

    record = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="qwen3:14b",
        prompt="Explain the assignment bug.",
        max_output_tokens=200,
        prompt_tokens=20,
    )

    assert coordinator.claim_job_for_worker("worker-low") is None
    queue_reason = coordinator.explain_worker_queue("worker-low")
    assert queue_reason["summary"]
    assert "host RAM" in queue_reason["summary"]

    assignment = coordinator.assign_next_job()

    assert assignment is not None
    assert assignment.worker_id == "worker-high"
    assert coordinator.job_snapshot(record.request.job_id)["assigned_worker_id"] == "worker-high"


def test_quality_tier_routes_to_matching_band_and_charges_more() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=10.0)
    coordinator.register_user("bob")
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-bob",
            owner_user_id="bob",
            installed_models={
                "qwen3:4b": 72.0,
                "glm4:9b": 48.0,
                "gpt-oss:20b": 24.0,
            },
        )
    )

    good_job = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="good",
        prompt="Cheap mode.",
        max_output_tokens=180,
        prompt_tokens=18,
    )
    better_job = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="better",
        prompt="Balanced mode.",
        max_output_tokens=180,
        prompt_tokens=18,
    )
    best_job = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="best",
        prompt="Premium mode.",
        max_output_tokens=180,
        prompt_tokens=18,
    )

    first = coordinator.assign_next_job()
    assert first is not None and first.model_tag == "qwen3:4b"
    coordinator.complete_job(
        JobResult(
            job_id=good_job.request.job_id,
            worker_id="worker-bob",
            success=True,
            verified=True,
            output_tokens=90,
            latency_seconds=1.0,
            output_text="good",
        )
    )

    second = coordinator.assign_next_job()
    assert second is not None and second.model_tag == "glm4:9b"
    coordinator.complete_job(
        JobResult(
            job_id=better_job.request.job_id,
            worker_id="worker-bob",
            success=True,
            verified=True,
            output_tokens=90,
            latency_seconds=1.0,
            output_text="better",
        )
    )

    third = coordinator.assign_next_job()
    assert third is not None and third.model_tag == "gpt-oss:20b"
    assert good_job.reserved_credits < better_job.reserved_credits < best_job.reserved_credits


def test_auto_prefers_balanced_worker_over_extreme_large_model() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=20.0)
    coordinator.register_user("bob")
    coordinator.register_user("carol")
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-bob",
            owner_user_id="bob",
            installed_models={
                "qwen3:14b": 42.0,
            },
        )
    )
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-carol",
            owner_user_id="carol",
            installed_models={
                "deepseek-r1:671b": 6.0,
            },
            vram_gb=512.0,
            system_ram_gb=512.0,
        )
    )

    coordinator.submit_job(
        requester_user_id="alice",
        model_tag="auto",
        prompt="Default routing should avoid the giant worker.",
        max_output_tokens=200,
        prompt_tokens=20,
    )
    assignment = coordinator.assign_next_job()

    assert assignment is not None
    assert assignment.worker_id == "worker-bob"
    assert assignment.model_tag == "qwen3:14b"


def test_explicit_large_model_tag_can_route_to_high_end_worker() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=20.0)
    coordinator.register_user("carol")
    coordinator.register_worker(
        make_multi_model_worker(
            worker_id="worker-carol",
            owner_user_id="carol",
            installed_models={
                "deepseek-r1:671b": 6.0,
            },
            vram_gb=512.0,
            system_ram_gb=512.0,
        )
    )

    coordinator.submit_job(
        requester_user_id="alice",
        model_tag="deepseek-r1:671b",
        prompt="Use the large reasoning model explicitly.",
        max_output_tokens=200,
        prompt_tokens=20,
    )
    assignment = coordinator.assign_next_job()

    assert assignment is not None
    assert assignment.worker_id == "worker-carol"
    assert assignment.model_tag == "deepseek-r1:671b"
