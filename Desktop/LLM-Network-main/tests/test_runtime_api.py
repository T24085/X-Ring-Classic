from __future__ import annotations

import json
import threading
import time
from typing import Optional
from urllib import request

from ollama_network.api import NetworkHTTPServer
from ollama_network.auth import AuthenticationError
from ollama_network.local_hardware import LocalGPUDevice, LocalHardwareDetection
from ollama_network.ollama_local import LocalModelDetection
from ollama_network.models import ExecutorResult, WorkerNode
from ollama_network.service import NetworkService
from ollama_network.state_store import LocalStateStore
from ollama_network.worker_daemon import WorkerConfig, WorkerDaemon


class FakeExecutor:
    def __init__(self, output_text: str = "completed from fake executor") -> None:
        self.output_text = output_text

    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        return ExecutorResult(
            success=True,
            output_text=f"{self.output_text}: {model_tag}",
            output_tokens=48,
            latency_seconds=0.01,
            verified=True,
        )


class FailingExecutor:
    def __init__(self, error_message: str = "simulated failure") -> None:
        self.error_message = error_message

    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        return ExecutorResult(
            success=False,
            output_text="",
            output_tokens=0,
            latency_seconds=0.01,
            verified=False,
            error_message=self.error_message,
        )


class FakeModelDetector:
    def __init__(self, models: list[str], available: bool = True, error: str = "") -> None:
        self._result = LocalModelDetection(
            ollama_available=available,
            models=models,
            error=error,
        )

    def detect(self) -> LocalModelDetection:
        return self._result


class FakeHardwareDetector:
    def detect(self) -> LocalHardwareDetection:
        return LocalHardwareDetection(
            detected=True,
            primary_gpu_name="RTX 4090",
            primary_vram_gb=24.0,
            system_ram_gb=32.0,
            gpus=[LocalGPUDevice(name="RTX 4090", vram_gb=24.0, source="fake")],
            error="",
        )


def api_post(
    base_url: str,
    path: str,
    payload: dict[str, object],
    headers: Optional[dict[str, str]] = None,
) -> dict[str, object]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url=f"{base_url}{path}",
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def api_get(
    base_url: str,
    path: str,
    headers: Optional[dict[str, str]] = None,
) -> dict[str, object]:
    req = request.Request(
        url=f"{base_url}{path}",
        headers=headers or {},
        method="GET",
    )
    with request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def text_get(base_url: str, path: str) -> str:
    with request.urlopen(f"{base_url}{path}", timeout=10) as response:
        return response.read().decode("utf-8")


class FakeAuthVerifier:
    def verify(self, token: str) -> dict[str, object]:
        if token == "valid-token":
            return {
                "uid": "firebase-user-1",
                "email": "tester@example.com",
                "name": "Test User",
            }
        if token == "admin-token":
            return {
                "uid": "firebase-admin-1",
                "email": "admin@example.com",
                "name": "Admin User",
            }
        raise AuthenticationError("bad token")


def test_worker_daemon_executes_claimed_job_end_to_end(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor(),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
    )
    server = NetworkHTTPServer(("127.0.0.1", 0), service=service)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        service.coordinator.register_user("alice", starting_credits=5.0)
        service.coordinator.register_user("bob", starting_credits=0.0)
        issued = api_post(base_url, "/users/issue", {})
        assert issued["user_id"].startswith("usr_")
        worker = WorkerDaemon(
            config=WorkerConfig(
                server_url=base_url,
                worker_id="worker-bob",
                owner_user_id="bob",
                gpu_name="RTX 4090",
                vram_gb=24.0,
                installed_models=("llama3.1:8b",),
                benchmark_tokens_per_second={"llama3.1:8b": 72.0},
            ),
            executor=FakeExecutor(),
        )
        worker.register()

        created = api_post(
            base_url,
            "/jobs",
            {
                "requester_user_id": "alice",
                "model_tag": "llama3.1:8b",
                "prompt": "Write a concise network design note.",
                "max_output_tokens": 300,
                "prompt_tokens": 20,
            },
        )

        completed = worker.run_once()
        assert completed is not None
        assert completed["status"] == "completed"
        assert completed["assigned_worker_id"] == "worker-bob"
        assert completed["result"]["output_text"].startswith("completed from fake executor")

        fetched = api_get(base_url, f"/jobs/{created['job_id']}")
        assert fetched["status"] == "completed"

        network = api_get(base_url, "/network")
        assert network["user_count"] == 3
        assert network["privacy"]["balances_exposed"] is False
        assert api_get(base_url, "/users/bob")["balance"] > 0
        assert api_get(base_url, "/users/alice")["balance"] < 5.0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_dashboard_and_local_worker_cycle_routes(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor("ui executor"),
        model_detector=FakeModelDetector(models=["llama3.1:8b", "qwen3:4b", "my-lab-model:3b"]),
        hardware_detector=FakeHardwareDetector(),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
    )
    server = NetworkHTTPServer(("127.0.0.1", 0), service=service)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        landing = text_get(base_url, "/")
        assert "Run the network from one front door." in landing
        assert "Operator Credits" in landing
        html = text_get(base_url, "/dashboard")
        assert "LLM Network Dashboard" in html
        assert "Live Network Map" in html
        assert "Neural view of the live mesh" in html
        assert 'const authReady = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);' in html
        assert "Firebase not configured" in html
        models = api_get(base_url, "/models")
        assert any(model["tag"] == "llama3.1:8b" for model in models["models"])
        assert models["local_detection"]["detected_models"] == [
            "llama3.1:8b",
            "qwen3:4b",
            "my-lab-model:3b",
        ]
        assert models["local_detection"]["network_supported_local_models"] == [
            "llama3.1:8b",
            "qwen3:4b",
        ]
        assert models["local_detection"]["unsupported_local_models"] == ["my-lab-model:3b"]
        worker_context = api_get(base_url, "/worker-context")
        assert worker_context["suggested_gpu_name"] == "RTX 4090"
        assert worker_context["suggested_vram_gb"] == 24.0
        assert worker_context["suggested_installed_models"] == [
            "llama3.1:8b",
            "qwen3:4b",
            "my-lab-model:3b",
        ]
        assert worker_context["network_supported_local_models"] == ["llama3.1:8b", "qwen3:4b"]
        assert worker_context["unsupported_local_models"] == ["my-lab-model:3b"]
        assert worker_context["suggested_benchmark_tokens_per_second"]["llama3.1:8b"] > 0
        assert worker_context["suggested_benchmark_tokens_per_second"]["my-lab-model:3b"] > 0

        service.coordinator.ledger.adjust("bob", amount=50, source="test_setup")
        issued = api_post(base_url, "/users/issue", {})
        assert issued["user_id"].startswith("usr_")
        service.coordinator.ledger.adjust(issued["user_id"], amount=50, source="test_setup")

        started = api_post(
            base_url,
            "/workers/start-local",
            {
                "worker_id": "worker-bob",
                "owner_user_id": "bob",
                "gpu_name": "RTX 4090",
                "vram_gb": 24,
                "system_ram_gb": 32,
                "installed_models": ["llama3.1:8b", "my-lab-model:3b"],
                "benchmark_tokens_per_second": {"llama3.1:8b": 72, "my-lab-model:3b": 90},
                "poll_interval_seconds": 0.05,
                "runtime": "ollama",
                "allows_cloud_fallback": False,
            },
        )
        assert started["loop"]["running"] is True
        assert started["worker"]["installed_models"] == ["llama3.1:8b", "my-lab-model:3b"]
        assert started["worker"]["system_ram_gb"] == 32.0
        api_post(
            base_url,
            "/jobs",
            {
                "requester_user_id": issued["user_id"],
                "model_tag": "llama3.1:8b",
                "prompt": "Generate a design memo.",
                "max_output_tokens": 200,
                "prompt_tokens": 20,
            },
        )

        completed_job = None
        for _ in range(40):
            network = api_get(base_url, "/network")
            local_loop = network["local_workers"]["worker-bob"]
            if local_loop["jobs_completed"] >= 1:
                completed_job = local_loop
                break
            time.sleep(0.05)
        assert completed_job is not None
        stats = api_get(base_url, "/workers/worker-bob/stats")
        assert stats["summary"]["completed_jobs"] >= 1
        assert stats["summary"]["billed_tokens"] > 0
        assert any(job["job_id"] for job in stats["recent_jobs"])

        user = api_get(base_url, "/users/bob")
        assert user["balance"] > 0

        stopped = api_post(base_url, "/workers/worker-bob/stop-local", {})
        assert stopped["loop"]["running"] is False

        missing_error = None
        try:
            api_get(base_url, "/users/unknown_user")
        except Exception as error:
            missing_error = error
        assert missing_error is not None
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_protected_api_requires_auth_and_binds_stable_user(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor(),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
        admin_emails={"admin@example.com"},
    )
    server = NetworkHTTPServer(
        ("127.0.0.1", 0),
        service=service,
        auth_verifier=FakeAuthVerifier(),
        firebase_client_config={"projectId": "llm-network"},
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        unauthorized = None
        try:
            api_get(base_url, "/models")
        except Exception as error:
            unauthorized = error
        assert unauthorized is not None

        headers = {"Authorization": "Bearer valid-token"}
        session = api_get(base_url, "/auth/session", headers=headers)
        assert session["user_id"].startswith("usr_")
        assert session["issued"] is True
        assert session["is_admin"] is False

        worker_context = api_get(base_url, "/worker-context", headers=headers)
        assert worker_context["suggested_owner_user_id"] == session["user_id"]
        assert worker_context["suggested_worker_id"].startswith("worker-")

        second_session = api_get(base_url, "/auth/session", headers=headers)
        assert second_session["user_id"] == session["user_id"]
        assert second_session["issued"] is False

        wallet = api_get(base_url, "/wallet", headers=headers)
        assert wallet["available_credits"] == session["wallet"]["available_credits"]

        purchased = api_post(
            base_url,
            "/credits/purchase",
            {"usd_amount": 2},
            headers=headers,
        )
        assert purchased["credits_added"] == 200

        ledger = api_get(base_url, "/ledger", headers=headers)
        assert any(entry["entry_type"] == "purchase" for entry in ledger["entries"])

        balance = api_get(base_url, f"/users/{session['user_id']}", headers=headers)
        assert balance["balance"] == session["balance"] + 200

        admin_headers = {"Authorization": "Bearer admin-token"}
        admin_session = api_get(base_url, "/auth/session", headers=admin_headers)
        assert admin_session["is_admin"] is True

        api_post(
            base_url,
            "/workers/start-local",
            {
                "worker_id": "worker-admin",
                "owner_user_id": admin_session["user_id"],
                "gpu_name": "RTX 4090",
                "vram_gb": 24,
                "installed_models": ["llama3.1:8b"],
                "benchmark_tokens_per_second": {"llama3.1:8b": 72},
                "poll_interval_seconds": 0.05,
                "runtime": "ollama",
                "allows_cloud_fallback": False,
                "allow_admin_self_serve": True,
            },
            headers=admin_headers,
        )
        own_job = api_post(
            base_url,
            "/jobs",
            {
                "requester_user_id": admin_session["user_id"],
                "model_tag": "llama3.1:8b",
                "prompt": "Let my admin worker preview this prompt.",
                "max_output_tokens": 120,
                "prompt_tokens": 18,
            },
            headers=admin_headers,
        )
        forced = api_post(
            base_url,
            "/workers/worker-admin/run-once",
            {"allow_admin_self_serve": True},
            headers=admin_headers,
        )
        assert forced["job"]["job_id"] == own_job["job_id"]
        assert forced["job"]["status"] == "completed"
        assert forced["job"]["assigned_worker_id"] == "worker-admin"
        assert forced["job"]["result"]["output_text"].startswith("completed from fake executor")

        overview = api_get(base_url, "/admin/overview", headers=admin_headers)
        assert overview["summary"]["known_firebase_accounts"] >= 2
        assert any(user["user_id"] == session["user_id"] for user in overview["users"])

        adjusted = api_post(
            base_url,
            f"/admin/users/{session['user_id']}/credits",
            {"amount": 75, "note": "support_grant"},
            headers=admin_headers,
        )
        assert adjusted["wallet"]["available_credits"] == balance["balance"] + 75

        admin_error = None
        try:
            api_get(base_url, "/admin/overview", headers=headers)
        except Exception as error:
            admin_error = error
        assert admin_error is not None
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_admin_can_restart_a_failed_job_as_a_new_submission(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FailingExecutor(),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
        admin_emails={"admin@example.com"},
    )
    server = NetworkHTTPServer(
        ("127.0.0.1", 0),
        service=service,
        auth_verifier=FakeAuthVerifier(),
        firebase_client_config={"projectId": "llm-network"},
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        admin_headers = {"Authorization": "Bearer admin-token"}
        service.coordinator.register_user("requester", starting_credits=200.0)
        service.coordinator.register_user("worker-owner", starting_credits=0.0)
        service.coordinator.register_worker(
            WorkerNode(
                worker_id="worker-restart",
                owner_user_id="worker-owner",
                gpu_name="RTX 4090",
                vram_gb=24.0,
                installed_models={"llama3.1:8b"},
                benchmark_tokens_per_second={"llama3.1:8b": 72.0},
                online=True,
                public_pool=True,
                runtime="ollama",
                allows_cloud_fallback=False,
            )
        )
        worker = WorkerDaemon(
            config=WorkerConfig(
                server_url=base_url,
                worker_id="worker-restart",
                owner_user_id="worker-owner",
                gpu_name="RTX 4090",
                vram_gb=24.0,
                installed_models=("llama3.1:8b",),
                benchmark_tokens_per_second={"llama3.1:8b": 72.0},
                firebase_id_token="admin-token",
            ),
            executor=FailingExecutor(),
        )
        created = service.submit_job(
            {
                "requester_user_id": "requester",
                "model_tag": "llama3.1:8b",
                "prompt": "Please retry this job.",
                "max_output_tokens": 140,
                "prompt_tokens": 16,
            },
            actor_user_id="requester",
        )

        failed = worker.run_once()
        assert failed is not None
        assert failed["status"] == "failed"

        original = api_get(base_url, f"/jobs/{created['job_id']}", headers=admin_headers)
        assert original["status"] == "failed"

        restarted = api_post(
            base_url,
            f"/admin/jobs/{created['job_id']}/restart",
            {},
            headers=admin_headers,
        )
        assert restarted["restarted_from_job_id"] == created["job_id"]
        assert restarted["job"]["job_id"] != created["job_id"]
        assert restarted["job"]["status"] == "queued"
        assert restarted["job"]["requester_user_id"] == created["requester_user_id"]
        assert restarted["job"]["model_tag"] == created["model_tag"]
        assert restarted["job"]["prompt"] == created["prompt"]
        assert restarted["job"]["conversation_id"] == created["conversation_id"]
        assert restarted["job"]["conversation_turn"] == created["conversation_turn"] + 1

        refetched_original = api_get(base_url, f"/jobs/{created['job_id']}", headers=admin_headers)
        assert refetched_original["status"] == "failed"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_user_can_restart_their_failed_job_as_a_new_submission(tmp_path) -> None:
    service = NetworkService(
        state_store=LocalStateStore(tmp_path / "private_state.json"),
        admin_emails={"admin@example.com"},
    )
    server = NetworkHTTPServer(
        ("127.0.0.1", 0),
        service=service,
        auth_verifier=FakeAuthVerifier(),
        firebase_client_config={"projectId": "llm-network"},
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        user_headers = {"Authorization": "Bearer valid-token"}
        session = api_get(base_url, "/auth/session", headers=user_headers)
        requester_user_id = session["user_id"]
        service.coordinator.register_worker(
            WorkerNode(
                worker_id="worker-user-restart",
                owner_user_id="worker-owner",
                gpu_name="RTX 4090",
                vram_gb=24.0,
                installed_models={"llama3.1:8b"},
                benchmark_tokens_per_second={"llama3.1:8b": 72.0},
                online=True,
                public_pool=True,
                runtime="ollama",
                allows_cloud_fallback=False,
            )
        )
        service.coordinator.register_user("worker-owner", starting_credits=0.0)

        created = api_post(
            base_url,
            "/jobs",
            {
                "requester_user_id": requester_user_id,
                "model_tag": "llama3.1:8b",
                "prompt": "Please retry this job.",
                "max_output_tokens": 140,
                "prompt_tokens": 16,
            },
            headers=user_headers,
        )

        assignment = service.coordinator.assign_next_job()
        assert assignment is not None
        completed = service.complete_job(
            {
                "job_id": assignment.job_id,
                "worker_id": assignment.worker_id,
                "success": False,
                "output_tokens": 0,
                "latency_seconds": 0.01,
                "verified": False,
                "prompt_tokens_used": 16,
                "output_text": "",
                "error_message": "simulated failure",
            },
            actor_user_id="worker-owner",
        )
        assert completed["status"] == "failed"

        restarted = api_post(
            base_url,
            f"/jobs/{created['job_id']}/restart",
            {},
            headers=user_headers,
        )
        assert restarted["restarted_from_job_id"] == created["job_id"]
        assert restarted["job"]["job_id"] != created["job_id"]
        assert restarted["job"]["status"] == "queued"
        assert restarted["job"]["requester_user_id"] == requester_user_id
        assert restarted["job"]["prompt"] == created["prompt"]
        assert restarted["job"]["conversation_id"] == created["conversation_id"]
        assert restarted["job"]["conversation_turn"] == created["conversation_turn"] + 1

        original = api_get(base_url, f"/jobs/{created['job_id']}", headers=user_headers)
        assert original["status"] == "failed"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_protected_api_accepts_long_lived_worker_token_for_remote_daemon(tmp_path) -> None:
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor("worker token executor"),
        state_store=LocalStateStore(tmp_path / "private_state.json"),
        admin_emails={"admin@example.com"},
    )
    server = NetworkHTTPServer(
        ("127.0.0.1", 0),
        service=service,
        auth_verifier=FakeAuthVerifier(),
        firebase_client_config={"projectId": "llm-network"},
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}"

    try:
        owner_headers = {"Authorization": "Bearer valid-token"}
        owner_session = api_get(base_url, "/auth/session", headers=owner_headers)
        token_result = service.issue_worker_token(
            actor_user_id=owner_session["user_id"],
            label="jetson-nano",
        )
        worker_token = str(token_result["token"])
        worker_headers = {"X-Worker-Token": worker_token}

        registered = api_post(
            base_url,
            "/workers/register",
            {
                "worker_id": "worker-jetson-nano",
                "owner_user_id": owner_session["user_id"],
                "gpu_name": "Jetson Nano",
                "vram_gb": 4.0,
                "system_ram_gb": 8.0,
                "installed_models": ["qwen3:4b"],
                "benchmark_tokens_per_second": {"qwen3:4b": 10.0},
                "runtime": "ollama",
                "allows_cloud_fallback": False,
            },
            headers=worker_headers,
        )
        assert registered["worker_id"] == "worker-jetson-nano"

        admin_headers = {"Authorization": "Bearer admin-token"}
        admin_session = api_get(base_url, "/auth/session", headers=admin_headers)
        service.coordinator.ledger.adjust(admin_session["user_id"], amount=50, source="test_setup")

        created = api_post(
            base_url,
            "/jobs",
            {
                "requester_user_id": admin_session["user_id"],
                "model_tag": "qwen3:4b",
                "prompt": "Run this through the token-auth worker path.",
                "max_output_tokens": 120,
                "prompt_tokens": 16,
            },
            headers=admin_headers,
        )

        worker = WorkerDaemon(
            config=WorkerConfig(
                server_url=base_url,
                worker_id="worker-jetson-nano",
                owner_user_id=owner_session["user_id"],
                    gpu_name="Jetson Nano",
                    vram_gb=4.0,
                    system_ram_gb=8.0,
                    installed_models=("qwen3:4b",),
                    benchmark_tokens_per_second={"qwen3:4b": 10.0},
                    worker_token=worker_token,
                ),
            executor=FakeExecutor("worker token executor"),
        )
        completed = worker.run_once()
        assert completed is not None
        assert completed["job_id"] == created["job_id"]
        assert completed["status"] == "completed"
        assert completed["assigned_worker_id"] == "worker-jetson-nano"
        assert completed["result"]["output_text"].startswith("worker token executor")

        fetched = api_get(base_url, f"/jobs/{created['job_id']}", headers=admin_headers)
        assert fetched["status"] == "completed"

        listed = service.list_worker_tokens(owner_session["user_id"])
        assert listed["tokens"][0]["label"] == "jetson-nano"
        assert listed["tokens"][0]["last_used_unix"] > 0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_conversation_history_persists_and_supports_archive_restore(tmp_path) -> None:
    store = LocalStateStore(tmp_path / "private_state.json")
    service = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor("history executor"),
        state_store=store,
    )
    service.coordinator.register_user("alice", starting_credits=25.0)
    service.coordinator.register_user("bob", starting_credits=0.0)
    service.register_worker(
        {
            "worker_id": "worker-bob",
            "owner_user_id": "bob",
            "gpu_name": "RTX 4090",
            "vram_gb": 24.0,
            "installed_models": ["llama3.1:8b"],
            "benchmark_tokens_per_second": {"llama3.1:8b": 72.0},
            "runtime": "ollama",
            "allows_cloud_fallback": False,
        },
        actor_user_id="bob",
    )
    created = service.submit_job(
        {
            "requester_user_id": "alice",
            "model_tag": "llama3.1:8b",
            "prompt": "Build an index.html and explain the structure.",
            "max_output_tokens": 180,
            "prompt_tokens": 24,
        },
        actor_user_id="alice",
    )
    completed = service.run_worker_cycle("worker-bob", executor=FakeExecutor("history executor"))

    assert completed is not None
    assert completed["conversation_id"] == created["conversation_id"]

    conversations = service.list_conversations("alice")
    assert len(conversations["conversations"]) == 1
    assert len(conversations["archived_conversations"]) == 0
    assert conversations["conversations"][0]["message_count"] == 2

    reloaded = NetworkService(
        executor_factory=lambda _worker_id: FakeExecutor("history executor"),
        state_store=store,
    )
    detail = reloaded.get_conversation(created["conversation_id"], actor_user_id="alice")
    assert len(detail["messages"]) == 2
    assert "history executor" in detail["messages"][1]["content"]

    archived = reloaded.archive_conversation(created["conversation_id"], actor_user_id="alice")
    assert archived["is_archived"] is True

    after_archive = reloaded.list_conversations("alice")
    assert len(after_archive["conversations"]) == 0
    assert len(after_archive["archived_conversations"]) == 1

    restored = reloaded.restore_conversation(created["conversation_id"], actor_user_id="alice")
    assert restored["is_archived"] is False

    after_restore = reloaded.list_conversations("alice")
    assert len(after_restore["conversations"]) == 1
    assert len(after_restore["archived_conversations"]) == 0
