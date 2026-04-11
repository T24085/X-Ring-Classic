from __future__ import annotations

from pprint import pprint

from .coordinator import OllamaNetworkCoordinator
from .models import JobResult, WorkerNode


def run_demo() -> None:
    coordinator = OllamaNetworkCoordinator()
    coordinator.register_user("alice", starting_credits=6.0)
    coordinator.register_user("bob", starting_credits=0.0)
    coordinator.register_worker(
        WorkerNode(
            worker_id="worker-bob-01",
            owner_user_id="bob",
            gpu_name="RTX 4090",
            vram_gb=24.0,
            installed_models={"llama3.1:8b", "qwen2.5:7b"},
            benchmark_tokens_per_second={"llama3.1:8b": 62.0, "qwen2.5:7b": 68.0},
            reliability_score=0.98,
        )
    )

    queued_job = coordinator.submit_job(
        requester_user_id="alice",
        model_tag="llama3.1:8b",
        prompt="Draft a product requirements summary for a local-only volunteer LLM network.",
        max_output_tokens=700,
    )
    print("Queued job:")
    pprint(queued_job)

    assignment = coordinator.assign_next_job()
    print("\nAssignment:")
    pprint(assignment)

    completed = coordinator.complete_job(
        JobResult(
            job_id=queued_job.request.job_id,
            worker_id="worker-bob-01",
            success=True,
            verified=True,
            output_tokens=420,
            latency_seconds=9.4,
            output_text="PRD summary...",
        )
    )
    print("\nCompleted record:")
    pprint(completed)

    print("\nBalances:")
    pprint(coordinator.snapshot().users)


if __name__ == "__main__":
    run_demo()
