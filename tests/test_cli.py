from __future__ import annotations

from io import StringIO
import threading

from ollama_network.api import NetworkHTTPServer
from ollama_network.cli import run_cli
from ollama_network.models import ExecutorResult
from ollama_network.service import NetworkService
from ollama_network.state_store import LocalStateStore


class FakeExecutor:
    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        return ExecutorResult(
            success=True,
            output_text=f"cli executor: {model_tag}",
            output_tokens=42,
            latency_seconds=0.01,
            verified=True,
        )


def test_cli_can_operate_the_runtime(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor(),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
    )
    server = NetworkHTTPServer(("127.0.0.1", 0), service=service)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    server_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        out = StringIO()
        issued = run_cli(
            [
                "--server-url",
                server_url,
                "issue-user",
                "--starting-credits",
                "6",
            ],
            stdout=out,
        )
        alice_id = issued["user_id"]
        assert alice_id.startswith("usr_")

        run_cli(
            [
                "--server-url",
                server_url,
                "register-worker",
                "--worker-id",
                "worker-bob",
                "--owner-user-id",
                "bob",
                "--gpu-name",
                "RTX 4090",
                "--vram-gb",
                "24",
                "--model",
                "llama3.1:8b",
                "--tps",
                "llama3.1:8b=72",
            ],
            stdout=StringIO(),
        )

        submitted = run_cli(
            [
                "--server-url",
                server_url,
                "submit-job",
                "--requester-user-id",
                alice_id,
                "--model-tag",
                "llama3.1:8b",
                "--prompt",
                "Create a note.",
                "--max-output-tokens",
                "180",
                "--prompt-tokens",
                "18",
            ],
            stdout=StringIO(),
        )
        assert submitted["status"] == "queued"

        completed = run_cli(
            [
                "--server-url",
                server_url,
                "run-worker-once",
                "--worker-id",
                "worker-bob",
            ],
            stdout=StringIO(),
        )
        assert completed["job"]["status"] == "completed"

        network = run_cli(
            ["--server-url", server_url, "network"],
            stdout=StringIO(),
        )
        assert network["user_count"] >= 2

        alice = run_cli(
            ["--server-url", server_url, "user", "--user-id", alice_id],
            stdout=StringIO(),
        )
        assert alice["user_id"] == alice_id

        bob = run_cli(
            ["--server-url", server_url, "user", "--user-id", "bob"],
            stdout=StringIO(),
        )
        assert bob["balance"] > 0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
