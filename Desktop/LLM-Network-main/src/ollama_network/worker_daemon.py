from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from typing import Optional, Union
from urllib import error, request

from .executor import OllamaCommandExecutor
from .models import ExecutorResult
from .local_hardware import LocalHardwareDetector
from .ollama_local import LocalOllamaModelDetector


@dataclass(frozen=True)
class WorkerConfig:
    server_url: str
    worker_id: str
    owner_user_id: str
    gpu_name: str
    vram_gb: float
    installed_models: tuple[str, ...]
    benchmark_tokens_per_second: dict[str, float]
    system_ram_gb: float = 0.0
    poll_interval_seconds: float = 2.0
    max_concurrent_jobs: int = 1
    worker_token: str = ""
    firebase_id_token: str = ""


class WorkerDaemon:
    def __init__(
        self,
        config: WorkerConfig,
        executor: Optional[Union[OllamaCommandExecutor, object]] = None,
    ) -> None:
        self.config = config
        self.executor = executor or OllamaCommandExecutor()

    def register(self) -> dict[str, object]:
        payload = {
            "worker_id": self.config.worker_id,
            "owner_user_id": self.config.owner_user_id,
            "gpu_name": self.config.gpu_name,
            "vram_gb": self.config.vram_gb,
            "system_ram_gb": self.config.system_ram_gb,
            "installed_models": list(self.config.installed_models),
            "benchmark_tokens_per_second": self.config.benchmark_tokens_per_second,
            "max_concurrent_jobs": self.config.max_concurrent_jobs,
            "runtime": "ollama",
            "allows_cloud_fallback": False,
        }
        return self._post("/workers/register", payload)

    def run_once(self) -> Optional[dict[str, object]]:
        claimed = self._post(f"/workers/{self.config.worker_id}/claim", {})
        assignment = claimed.get("assignment")
        if assignment is None:
            return None
        try:
            result: ExecutorResult = self.executor.run(
                model_tag=str(assignment["model_tag"]),
                prompt=str(assignment["prompt"]),
                max_output_tokens=int(assignment["max_output_tokens"]),
            )
        except Exception as error:
            result = ExecutorResult(
                success=False,
                output_text="",
                output_tokens=0,
                latency_seconds=0.0,
                verified=False,
                error_message=str(error),
            )
        payload = {
            "job_id": assignment["job_id"],
            "worker_id": self.config.worker_id,
            "success": result.success,
            "output_tokens": result.output_tokens,
            "latency_seconds": result.latency_seconds,
            "verified": result.verified,
            "output_text": result.output_text,
            "error_message": result.error_message,
        }
        return self._post("/jobs/complete", payload)

    def serve_forever(self) -> None:
        self.register()
        while True:
            self.run_once()
            time.sleep(self.config.poll_interval_seconds)

    def _post(self, path: str, payload: dict[str, object]) -> dict[str, object]:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.config.worker_token:
            headers["X-Worker-Token"] = self.config.worker_token
        if self.config.firebase_id_token:
            headers["Authorization"] = f"Bearer {self.config.firebase_id_token}"
        req = request.Request(
            url=f"{self.config.server_url.rstrip('/')}{path}",
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as http_error:
            detail = http_error.read().decode("utf-8")
            raise RuntimeError(f"API request failed: {http_error.code} {detail}") from http_error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run an Ollama Network worker daemon.")
    parser.add_argument("--server-url", default="http://127.0.0.1:8000", help="Coordinator API URL.")
    parser.add_argument("--worker-id", required=True, help="Stable worker identifier.")
    parser.add_argument("--owner-user-id", required=True, help="User id that earns credits.")
    parser.add_argument(
        "--gpu-name",
        default="",
        help="GPU label advertised to the network. Defaults to local hardware detection.",
    )
    parser.add_argument(
        "--vram-gb",
        type=float,
        default=0.0,
        help="Available GPU VRAM. Defaults to local hardware detection.",
    )
    parser.add_argument(
        "--system-ram-gb",
        type=float,
        default=0.0,
        help="Available host RAM. Defaults to 0 when unknown.",
    )
    parser.add_argument(
        "--model",
        action="append",
        dest="models",
        default=[],
        help="Approved Ollama model tag installed on this worker. Repeatable. Defaults to locally detected Ollama models.",
    )
    parser.add_argument(
        "--tps",
        action="append",
        dest="throughput_entries",
        default=[],
        help="Throughput entry in MODEL=TPS format. Repeatable.",
    )
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Poll interval in seconds.")
    parser.add_argument(
        "--worker-token",
        default=os.environ.get("OLLAMA_NETWORK_WORKER_TOKEN", ""),
        help="Optional long-lived worker token issued by the coordinator.",
    )
    parser.add_argument(
        "--firebase-id-token",
        default=os.environ.get("OLLAMA_NETWORK_FIREBASE_ID_TOKEN", ""),
        help="Optional Firebase ID token for protected servers. Prefer --worker-token for long-lived daemons.",
    )
    return parser


def resolve_worker_config(args: argparse.Namespace) -> WorkerConfig:
    hardware_detector = LocalHardwareDetector()
    model_detector = LocalOllamaModelDetector()
    hardware = hardware_detector.detect()
    model_detection = model_detector.detect()
    models = list(args.models or model_detection.models)
    if not models:
        raise ValueError("No worker models were provided and no local Ollama models were detected.")
    gpu_name = str(args.gpu_name or hardware.primary_gpu_name or "Unknown GPU").strip()
    vram_gb = float(args.vram_gb or hardware.primary_vram_gb or 0.0)
    system_ram_gb = float(args.system_ram_gb or hardware.system_ram_gb or 0.0)
    if not gpu_name:
        gpu_name = "Unknown GPU"
    if vram_gb <= 0:
        raise ValueError("GPU VRAM could not be detected. Provide --vram-gb explicitly.")
    return WorkerConfig(
        server_url=args.server_url,
        worker_id=args.worker_id,
        owner_user_id=args.owner_user_id,
        gpu_name=gpu_name,
        vram_gb=vram_gb,
        system_ram_gb=system_ram_gb,
        installed_models=tuple(models),
        benchmark_tokens_per_second=parse_throughput(args.throughput_entries, models),
        poll_interval_seconds=args.poll_interval,
        worker_token=args.worker_token,
        firebase_id_token=args.firebase_id_token,
    )


def parse_throughput(entries: list[str], models: list[str]) -> dict[str, float]:
    throughput: dict[str, float] = {}
    for entry in entries:
        if "=" not in entry:
            raise ValueError(f"Invalid throughput entry '{entry}'. Expected MODEL=TPS.")
        model_tag, value = entry.split("=", maxsplit=1)
        throughput[model_tag] = float(value)
    for model_tag in models:
        throughput.setdefault(model_tag, 1.0)
    return throughput


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    config = resolve_worker_config(args)
    daemon = WorkerDaemon(config=config)
    print(
        f"Worker {args.worker_id} serving {', '.join(config.installed_models)} via {args.server_url}"
    )
    daemon.serve_forever()


if __name__ == "__main__":
    main()
