from __future__ import annotations

from collections import deque
from dataclasses import asdict
from time import time
from typing import Optional
from uuid import uuid4

from .artifacts import extract_job_artifacts
from .catalog import ApprovedModelCatalog, QUALITY_SELECTORS
from .ledger import CreditLedger, PLATFORM_WALLET_ID
from .models import (
    JobAssignment,
    JobRecord,
    JobRequest,
    JobResult,
    JobStatus,
    NetworkSnapshot,
    PolicyError,
    WorkerNode,
)

QUALITY_TIER_RANK = {"good": 1, "better": 2, "best": 3}
PRICING_TIER_RANK = {
    "tier_1_small": 1,
    "tier_2_standard": 2,
    "tier_3_large": 3,
    "tier_4_reasoning": 4,
}


class OllamaNetworkCoordinator:
    """In-memory coordinator for a reciprocal local-only Ollama worker pool."""

    def __init__(
        self,
        catalog: Optional[ApprovedModelCatalog] = None,
        ledger: Optional[CreditLedger] = None,
    ) -> None:
        self.catalog = catalog or ApprovedModelCatalog.default()
        self.ledger = ledger or CreditLedger()
        self.workers: dict[str, WorkerNode] = {}
        self.jobs: dict[str, JobRecord] = {}
        self._queued_job_ids: deque[str] = deque()

    def register_user(self, user_id: str, starting_credits: float = 0.0) -> None:
        self.ledger.register_user(user_id=user_id, starting_credits=int(round(starting_credits)))

    def register_worker(self, worker: WorkerNode) -> None:
        if not worker.worker_id.strip():
            raise PolicyError("Worker ID is required.")
        if not worker.owner_user_id.strip():
            raise PolicyError("Worker owner user ID is required.")
        if not worker.gpu_name.strip():
            raise PolicyError("GPU name is required.")
        if not worker.installed_models:
            raise PolicyError("At least one installed Ollama model is required.")
        if worker.runtime != "ollama" or worker.allows_cloud_fallback:
            raise PolicyError("Workers must run Ollama locally with cloud fallback disabled.")
        self.register_user(worker.owner_user_id)
        worker.last_heartbeat_unix = time()
        self.workers[worker.worker_id] = worker

    def update_worker(self, worker_id: str, online: bool = True) -> WorkerNode:
        worker = self.workers[worker_id]
        worker.online = online
        worker.last_heartbeat_unix = time()
        return worker

    def submit_job(
        self,
        requester_user_id: str,
        model_tag: str,
        prompt: str,
        max_output_tokens: int,
        compiled_prompt: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        privacy_tier: str = "public",
        conversation_id: str = "",
        conversation_turn: int = 0,
    ) -> JobRecord:
        if privacy_tier != "public":
            raise PolicyError(
                "This volunteer network only accepts public jobs until secure attestation is added."
            )
        submitted_at = time()
        selector = self.catalog.normalize_selector(model_tag)
        self.register_user(requester_user_id)
        estimated_prompt_tokens = prompt_tokens or self._estimate_prompt_tokens(prompt)
        reserved_credits = self.catalog.estimate_reservation(
            selector=selector,
            prompt_tokens=estimated_prompt_tokens,
            max_output_tokens=max_output_tokens,
        )
        job_id = f"job-{uuid4().hex[:10]}"
        request = JobRequest(
            job_id=job_id,
            requester_user_id=requester_user_id,
            model_tag=selector,
            prompt=prompt,
            compiled_prompt=compiled_prompt or prompt,
            prompt_tokens=estimated_prompt_tokens,
            max_output_tokens=max_output_tokens,
            privacy_tier=privacy_tier,
            submitted_at_unix=submitted_at,
            conversation_id=conversation_id,
            conversation_turn=conversation_turn,
        )
        self.ledger.reserve(user_id=requester_user_id, job_id=job_id, amount=reserved_credits)
        record = JobRecord(request=request, reserved_credits=reserved_credits)
        self.jobs[job_id] = record
        self._queued_job_ids.append(job_id)
        return record

    def assign_next_job(self) -> Optional[JobAssignment]:
        for _ in range(len(self._queued_job_ids)):
            job_id = self._queued_job_ids.popleft()
            record = self.jobs[job_id]
            if record.status is not JobStatus.QUEUED:
                continue
            worker = self._select_worker(record)
            if worker is None:
                self._queued_job_ids.append(job_id)
                continue
            resolved_model = self._resolve_model_for_worker(worker, record.request.model_tag)
            if resolved_model is None:
                self._queued_job_ids.append(job_id)
                continue
            record.status = JobStatus.ASSIGNED
            record.assigned_worker_id = worker.worker_id
            record.resolved_model_tag = resolved_model.tag
            record.assigned_at_unix = time()
            worker.active_jobs += 1
            return JobAssignment(
                job_id=job_id,
                worker_id=worker.worker_id,
                model_tag=resolved_model.tag,
                reserved_credits=record.reserved_credits,
                prompt=record.request.compiled_prompt,
                prompt_tokens=record.request.prompt_tokens,
                max_output_tokens=record.request.max_output_tokens,
            )
        return None

    def claim_job_for_worker(
        self,
        worker_id: str,
        allow_own_jobs: bool = False,
    ) -> Optional[JobAssignment]:
        worker = self.update_worker(worker_id=worker_id, online=True)
        for _ in range(len(self._queued_job_ids)):
            job_id = self._queued_job_ids.popleft()
            record = self.jobs[job_id]
            if record.status is not JobStatus.QUEUED:
                continue
            resolved_model = self._resolve_model_for_worker(worker, record.request.model_tag)
            if (
                (not allow_own_jobs and worker.owner_user_id == record.request.requester_user_id)
                or resolved_model is None
                or not worker.supports_model(resolved_model)
            ):
                self._queued_job_ids.append(job_id)
                continue
            record.status = JobStatus.ASSIGNED
            record.assigned_worker_id = worker.worker_id
            record.resolved_model_tag = resolved_model.tag
            record.assigned_at_unix = time()
            worker.active_jobs += 1
            return JobAssignment(
                job_id=job_id,
                worker_id=worker.worker_id,
                model_tag=resolved_model.tag,
                reserved_credits=record.reserved_credits,
                prompt=record.request.compiled_prompt,
                prompt_tokens=record.request.prompt_tokens,
                max_output_tokens=record.request.max_output_tokens,
            )
        return None

    def complete_job(self, result: JobResult) -> JobRecord:
        record = self.jobs[result.job_id]
        if record.assigned_worker_id != result.worker_id:
            raise PolicyError("Job results must come from the assigned worker.")
        worker = self.workers[result.worker_id]
        worker.last_heartbeat_unix = time()
        worker.active_jobs = max(worker.active_jobs - 1, 0)
        record.result = result
        if not result.success or not result.verified:
            self.ledger.release(
                job_id=result.job_id,
                source="job_failed_or_unverified",
            )
            record.status = JobStatus.FAILED
            record.refunded_credits = record.reserved_credits
            record.prompt_tokens_used = result.prompt_tokens_used or record.request.prompt_tokens
            record.completed_at_unix = time()
            return record
        if worker.owner_user_id == record.request.requester_user_id:
            self.ledger.release(
                job_id=result.job_id,
                source="self_served_refund",
            )
            record.status = JobStatus.COMPLETED
            record.refunded_credits = record.reserved_credits
            record.prompt_tokens_used = result.prompt_tokens_used or record.request.prompt_tokens
            record.billed_tokens = record.prompt_tokens_used + result.output_tokens
            record.completed_at_unix = time()
            return record
        prompt_tokens_used = result.prompt_tokens_used or record.request.prompt_tokens
        actual_credits = min(
            record.reserved_credits,
            self.catalog.actual_cost(
                selector=record.request.model_tag,
                resolved_model_tag=record.resolved_model_tag or record.request.model_tag,
                prompt_tokens=prompt_tokens_used,
                output_tokens=result.output_tokens,
            ),
        )
        billed_tokens = prompt_tokens_used + result.output_tokens
        final_cost, refund, worker_share, platform_share = self.ledger.settle(
            job_id=result.job_id,
            worker_user_id=worker.owner_user_id,
            final_cost=actual_credits,
        )
        record.actual_credits = final_cost
        record.prompt_tokens_used = prompt_tokens_used
        record.billed_tokens = billed_tokens
        record.refunded_credits = refund
        record.worker_earned_credits = worker_share
        record.platform_fee_credits = platform_share
        record.status = JobStatus.COMPLETED
        record.completed_at_unix = time()
        return record

    def snapshot(self) -> NetworkSnapshot:
        return NetworkSnapshot(
            users={user_id: self.ledger.balance_of(user_id) for user_id in self._known_users()},
            queued_jobs=list(self._queued_job_ids),
            active_jobs={
                worker_id: worker.active_jobs for worker_id, worker in self.workers.items()
            },
        )

    def worker_snapshot(self, worker_id: str) -> dict[str, object]:
        worker = self.workers[worker_id]
        payload = asdict(worker)
        payload["installed_models"] = sorted(worker.installed_models)
        return payload

    def job_snapshot(self, job_id: str) -> dict[str, object]:
        record = self.jobs[job_id]
        payload = {
            "job_id": record.request.job_id,
            "requester_user_id": record.request.requester_user_id,
            "model_tag": record.request.model_tag,
            "resolved_model_tag": record.resolved_model_tag,
            "prompt": record.request.prompt,
            "compiled_prompt": record.request.compiled_prompt,
            "prompt_tokens": record.request.prompt_tokens,
            "max_output_tokens": record.request.max_output_tokens,
            "privacy_tier": record.request.privacy_tier,
            "submitted_at_unix": record.request.submitted_at_unix,
            "conversation_id": record.request.conversation_id,
            "conversation_turn": record.request.conversation_turn,
            "assigned_at_unix": record.assigned_at_unix,
            "completed_at_unix": record.completed_at_unix,
            "reserved_credits": record.reserved_credits,
            "status": record.status.value,
            "assigned_worker_id": record.assigned_worker_id,
            "actual_credits": record.actual_credits,
            "prompt_tokens_used": record.prompt_tokens_used,
            "output_tokens_used": record.result.output_tokens if record.result else 0,
            "billed_tokens": record.billed_tokens,
            "worker_earned_credits": record.worker_earned_credits,
            "platform_fee_credits": record.platform_fee_credits,
            "refunded_credits": record.refunded_credits,
            "result": asdict(record.result) if record.result else None,
            "artifacts": extract_job_artifacts(
                record.result.output_text if record.result else "",
                prompt=record.request.prompt,
            ),
        }
        return payload

    def list_jobs_for_user(
        self,
        requester_user_id: str,
        limit: int = 20,
    ) -> list[dict[str, object]]:
        jobs = [
            self.job_snapshot(job_id)
            for job_id, record in self.jobs.items()
            if record.request.requester_user_id == requester_user_id
        ]
        jobs.sort(
            key=lambda item: (
                float(item.get("submitted_at_unix", 0.0)),
                str(item.get("job_id", "")),
            ),
            reverse=True,
        )
        return jobs[: max(limit, 0)]

    def explain_worker_queue(
        self,
        worker_id: str,
        allow_own_jobs: bool = False,
    ) -> dict[str, object]:
        worker = self.workers[worker_id]
        queued_records = [
            self.jobs[job_id]
            for job_id in self._queued_job_ids
            if job_id in self.jobs and self.jobs[job_id].status is JobStatus.QUEUED
        ]
        blocked_examples: list[dict[str, str]] = []
        compatible_count = 0
        for record in queued_records:
            reason = self._queue_block_reason(worker, record, allow_own_jobs=allow_own_jobs)
            if not reason:
                compatible_count += 1
                continue
            if len(blocked_examples) < 3:
                blocked_examples.append(
                    {
                        "job_id": record.request.job_id,
                        "model_tag": record.request.model_tag,
                        "requester_user_id": record.request.requester_user_id,
                        "reason": reason,
                    }
                )
        summary = "No queued jobs."
        if compatible_count:
            summary = f"{compatible_count} compatible queued job(s) available."
        elif blocked_examples:
            summary = blocked_examples[0]["reason"]
        return {
            "worker_id": worker_id,
            "queued_jobs": len(queued_records),
            "compatible_jobs": compatible_count,
            "blocked_examples": blocked_examples,
            "summary": summary,
        }

    def cancel_queued_job(
        self,
        job_id: str,
        reason: str = "",
    ) -> JobRecord:
        record = self.jobs[job_id]
        if record.status is not JobStatus.QUEUED:
            raise PolicyError("Only queued jobs can be canceled.")
        self._queued_job_ids = deque(queued_id for queued_id in self._queued_job_ids if queued_id != job_id)
        refunded = 0
        if job_id in self.ledger.export_state().get("holds", {}):
            refunded = self.ledger.release(
                job_id=job_id,
                source=f"admin_cancel:{reason.strip() or 'queued job canceled'}",
            )
        record.status = JobStatus.CANCELED
        record.refunded_credits = refunded
        record.completed_at_unix = time()
        record.result = JobResult(
            job_id=job_id,
            worker_id="",
            success=False,
            output_tokens=0,
            latency_seconds=0.0,
            verified=False,
            output_text="",
            error_message=reason.strip() or "Canceled by admin.",
        )
        return record

    def reroute_queued_job(
        self,
        job_id: str,
        model_tag: str,
    ) -> JobRecord:
        record = self.jobs[job_id]
        if record.status is not JobStatus.QUEUED:
            raise PolicyError("Only queued jobs can be rerouted.")
        normalized_selector = self.catalog.normalize_selector(model_tag)
        record.request = JobRequest(
            job_id=record.request.job_id,
            requester_user_id=record.request.requester_user_id,
            model_tag=normalized_selector,
            prompt=record.request.prompt,
            compiled_prompt=record.request.compiled_prompt,
            prompt_tokens=record.request.prompt_tokens,
            max_output_tokens=record.request.max_output_tokens,
            privacy_tier=record.request.privacy_tier,
            submitted_at_unix=record.request.submitted_at_unix,
            conversation_id=record.request.conversation_id,
            conversation_turn=record.request.conversation_turn,
        )
        record.resolved_model_tag = None
        record.assigned_worker_id = None
        record.assigned_at_unix = 0.0
        return record

    def _known_users(self) -> set[str]:
        known = {
            user_id
            for user_id in self.ledger.export_state().get("wallets", {}).keys()
            if user_id != PLATFORM_WALLET_ID
        }
        known.update(worker.owner_user_id for worker in self.workers.values())
        known.update(record.request.requester_user_id for record in self.jobs.values())
        return known

    @staticmethod
    def _estimate_prompt_tokens(prompt: str) -> int:
        word_count = len([token for token in prompt.split() if token.strip()])
        return max(8, word_count * 2)

    def _select_worker(self, record: JobRecord) -> Optional[WorkerNode]:
        candidates = [
            worker
            for worker in self.workers.values()
            if worker.owner_user_id != record.request.requester_user_id
        ]
        scored_candidates: list[tuple[WorkerNode, object]] = []
        for worker in candidates:
            resolved_model = self._resolve_model_for_worker(worker, record.request.model_tag)
            if resolved_model is None or not worker.supports_model(resolved_model):
                continue
            scored_candidates.append((worker, resolved_model))
        if not scored_candidates:
            return None
        return max(
            scored_candidates,
            key=lambda item: self._worker_score(item[0], item[1], record.request.model_tag),
        )[0]

    def _worker_score(self, worker: WorkerNode, resolved_model, selector: str) -> float:
        throughput_score = (
            worker.benchmark_tokens_per_second.get(resolved_model.tag, 0.0)
            * max(worker.reliability_score, 0.1)
        )
        if selector not in QUALITY_SELECTORS:
            return throughput_score + (resolved_model.strength_score * 0.2)
        target_pricing_rank = {
            "good": PRICING_TIER_RANK["tier_1_small"],
            "better": PRICING_TIER_RANK["tier_2_standard"],
            "best": PRICING_TIER_RANK["tier_4_reasoning"],
            "auto": PRICING_TIER_RANK["tier_2_standard"],
        }[selector]
        resolved_pricing_rank = PRICING_TIER_RANK.get(resolved_model.pricing_tier, target_pricing_rank)
        distance_penalty = abs(resolved_pricing_rank - target_pricing_rank) * 30.0
        overshoot_penalty = max(0, resolved_pricing_rank - target_pricing_rank) * 25.0
        auto_vram_penalty = 0.0
        if selector == "auto":
            auto_vram_penalty = max(0.0, resolved_model.min_vram_gb - 24.0) / 4.0
        return (
            throughput_score
            + (resolved_model.strength_score * 0.2)
            - distance_penalty
            - overshoot_penalty
            - auto_vram_penalty
        )

    def _resolve_model_for_worker(
        self,
        worker: WorkerNode,
        selector: str,
        require_capacity: bool = True,
    ):
        supported_models = {
            model_tag
            for model_tag in worker.installed_models
            if model_tag in self.catalog.models
            and (
                not require_capacity
                or worker.supports_model(self.catalog.models[model_tag])
            )
        }
        return self.catalog.resolve_selector_for_models(selector, supported_models)

    def _queue_block_reason(
        self,
        worker: WorkerNode,
        record: JobRecord,
        allow_own_jobs: bool,
    ) -> str:
        if not allow_own_jobs and worker.owner_user_id == record.request.requester_user_id:
            return "This worker can only claim jobs from other users until admin self-serve is enabled."
        if worker.active_jobs >= worker.max_concurrent_jobs:
            return "This worker is already at its active job limit."
        if not worker.online:
            return "This worker is offline."
        resolved_model = self._resolve_model_for_worker(
            worker,
            record.request.model_tag,
            require_capacity=False,
        )
        if resolved_model is None:
            requested = record.request.model_tag
            if requested in self.catalog.models and requested not in worker.installed_models:
                return f"Queued job requires {requested}, which is not installed on this worker."
            return f"No compatible local model is available for queued selector {requested}."
        if not worker.supports_model(resolved_model):
            required_ram = resolved_model.estimated_system_ram_gb()
            available_ram = worker.effective_host_ram_gb()
            if available_ram < required_ram:
                source = "host RAM" if worker.system_ram_gb > 0 else "fallback memory estimate"
                return (
                    f"Queued job requires about {required_ram:g} GB host RAM for {resolved_model.tag}, "
                    f"but this worker only reports {available_ram:g} GB of {source}."
                )
            return f"Worker cannot currently serve {resolved_model.tag}."
        return ""

    def export_state(self) -> dict[str, object]:
        return {
            "workers": {
                worker_id: self.worker_snapshot(worker_id)
                for worker_id in self.workers
            },
            "jobs": {
                job_id: self.job_snapshot(job_id)
                for job_id in self.jobs
            },
            "queued_job_ids": list(self._queued_job_ids),
            "ledger": self.ledger.export_state(),
        }

    def import_state(self, payload: dict[str, object]) -> None:
        self.workers = {}
        for worker_id, worker_payload in dict(payload.get("workers", {})).items():
            candidate = WorkerNode(
                worker_id=str(worker_payload["worker_id"]),
                owner_user_id=str(worker_payload["owner_user_id"]),
                gpu_name=str(worker_payload["gpu_name"]),
                vram_gb=float(worker_payload["vram_gb"]),
                installed_models=set(worker_payload.get("installed_models", [])),
                benchmark_tokens_per_second={
                    str(key): float(value)
                    for key, value in dict(
                        worker_payload.get("benchmark_tokens_per_second", {})
                    ).items()
                },
                system_ram_gb=float(worker_payload.get("system_ram_gb", 0.0)),
                reliability_score=float(worker_payload.get("reliability_score", 1.0)),
                public_pool=bool(worker_payload.get("public_pool", True)),
                online=bool(worker_payload.get("online", True)),
                max_concurrent_jobs=int(worker_payload.get("max_concurrent_jobs", 1)),
                runtime=str(worker_payload.get("runtime", "ollama")),
                allows_cloud_fallback=bool(worker_payload.get("allows_cloud_fallback", False)),
                active_jobs=int(worker_payload.get("active_jobs", 0)),
                last_heartbeat_unix=(
                    float(worker_payload["last_heartbeat_unix"])
                    if worker_payload.get("last_heartbeat_unix") is not None
                    else None
                ),
            )
            try:
                self.register_worker(candidate)
            except PolicyError:
                continue

        self.jobs = {}
        for job_id, job_payload in dict(payload.get("jobs", {})).items():
            result_payload = job_payload.get("result")
            result = (
                JobResult(
                    job_id=str(result_payload["job_id"]),
                    worker_id=str(result_payload["worker_id"]),
                    success=bool(result_payload["success"]),
                    output_tokens=int(result_payload["output_tokens"]),
                    latency_seconds=float(result_payload["latency_seconds"]),
                    verified=bool(result_payload["verified"]),
                    prompt_tokens_used=int(result_payload.get("prompt_tokens_used", 0)),
                    output_text=str(result_payload.get("output_text", "")),
                    error_message=str(result_payload.get("error_message", "")),
                )
                if result_payload
                else None
            )
            self.jobs[str(job_id)] = JobRecord(
                request=JobRequest(
                    job_id=str(job_payload["job_id"]),
                    requester_user_id=str(job_payload["requester_user_id"]),
                    model_tag=str(job_payload["model_tag"]),
                    prompt=str(job_payload["prompt"]),
                    compiled_prompt=str(job_payload.get("compiled_prompt", job_payload.get("prompt", ""))),
                    prompt_tokens=int(job_payload["prompt_tokens"]),
                    max_output_tokens=int(job_payload["max_output_tokens"]),
                    privacy_tier=str(job_payload.get("privacy_tier", "public")),
                    submitted_at_unix=float(job_payload.get("submitted_at_unix", 0.0)),
                    conversation_id=str(job_payload.get("conversation_id", "")),
                    conversation_turn=int(job_payload.get("conversation_turn", 0)),
                ),
                reserved_credits=int(round(float(job_payload["reserved_credits"]))),
                status=JobStatus(str(job_payload["status"])),
                assigned_worker_id=(
                    str(job_payload["assigned_worker_id"])
                    if job_payload.get("assigned_worker_id") is not None
                    else None
                ),
                resolved_model_tag=(
                    str(job_payload["resolved_model_tag"])
                    if job_payload.get("resolved_model_tag") is not None
                    else None
                ),
                assigned_at_unix=float(job_payload.get("assigned_at_unix", 0.0)),
                completed_at_unix=float(job_payload.get("completed_at_unix", 0.0)),
                actual_credits=int(round(float(job_payload.get("actual_credits", 0.0)))),
                prompt_tokens_used=int(job_payload.get("prompt_tokens_used", 0)),
                billed_tokens=int(job_payload.get("billed_tokens", 0)),
                worker_earned_credits=int(job_payload.get("worker_earned_credits", 0)),
                platform_fee_credits=int(job_payload.get("platform_fee_credits", 0)),
                refunded_credits=int(job_payload.get("refunded_credits", 0)),
                result=result,
            )

        self._queued_job_ids = deque(str(job_id) for job_id in payload.get("queued_job_ids", []))
        self.ledger.import_state(dict(payload.get("ledger", {})))
