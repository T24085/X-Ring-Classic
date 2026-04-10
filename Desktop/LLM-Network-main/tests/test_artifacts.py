from __future__ import annotations

from pathlib import Path

from ollama_network.artifacts import extract_job_artifacts
from ollama_network.models import ExecutorResult
from ollama_network.service import NetworkService
from ollama_network.state_store import LocalStateStore


class FakeExecutor:
    def __init__(self, output_text: str) -> None:
        self.output_text = output_text

    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        return ExecutorResult(
            success=True,
            output_text=self.output_text,
            output_tokens=128,
            latency_seconds=0.01,
            verified=True,
        )


def test_extracts_html_file_artifact_from_inline_document() -> None:
    artifacts = extract_job_artifacts(
        "<!DOCTYPE html><html><head><title>Hello</title></head><body><h1>Hello</h1></body></html>",
        prompt="Create an advanced index.html file",
    )

    assert len(artifacts) == 1
    assert artifacts[0]["path"] == "index.html"
    assert artifacts[0]["language"] == "html"
    assert "<h1>Hello</h1>" in artifacts[0]["content"]


def test_service_can_materialize_and_zip_job_artifacts(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor(
            "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"
        ),
        state_store=LocalStateStore(Path(tmp_path) / "private_state.json"),
    )

    service.register_user("requester")
    service.register_user("worker_owner")
    service.coordinator.ledger.adjust("requester", amount=50, source="setup")
    service.register_worker(
        {
            "worker_id": "worker-1",
            "owner_user_id": "worker_owner",
            "gpu_name": "RTX 4090",
            "vram_gb": 24,
            "installed_models": ["glm4:9b"],
            "benchmark_tokens_per_second": {"glm4:9b": 72},
            "runtime": "ollama",
            "allows_cloud_fallback": False,
        },
        actor_user_id="worker_owner",
    )

    created = service.submit_job(
        {
            "requester_user_id": "requester",
            "model_tag": "glm4:9b",
            "prompt": "Create index.html for a landing page",
            "prompt_tokens": 50,
            "max_output_tokens": 500,
        },
        actor_user_id="requester",
    )
    completed = service.run_worker_cycle(
        "worker-1",
        executor=FakeExecutor("<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"),
    )

    assert completed["artifacts"][0]["path"] == "index.html"

    exported = service.create_job_artifacts(created["job_id"], actor_user_id="requester")
    assert exported["files"][0]["path"] == "index.html"
    assert Path(exported["files"][0]["absolute_path"]).read_text(encoding="utf-8").startswith("<!DOCTYPE html>")

    filename, content = service.download_job_artifacts(created["job_id"], actor_user_id="requester")
    assert filename.endswith(".zip")
    assert len(content) > 20
