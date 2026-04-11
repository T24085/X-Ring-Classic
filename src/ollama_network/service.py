from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import threading
from dataclasses import asdict
from pathlib import Path
from time import time
from typing import Any, Callable, Optional
from uuid import uuid4

from .auth import AuthenticationError
from .artifacts import extract_job_artifacts, materialize_artifacts, zip_artifacts
from .coordinator import OllamaNetworkCoordinator
from .executor import OllamaCommandExecutor
from .local_hardware import LocalHardwareDetector
from .catalog import QUALITY_SELECTORS
from .models import AuthorizationError, ExecutorResult, JobAssignment, JobResult, JobStatus, PolicyError, WorkerNode
from .ollama_local import LocalOllamaModelDetector
from .state_store import LocalStateStore, create_state_store

DEFAULT_ADMIN_EMAILS = {"christoffersent@gmail.com"}


class NetworkService:
    """Thread-safe facade that exposes coordinator operations to the API server."""

    def __init__(
        self,
        coordinator: Optional[OllamaNetworkCoordinator] = None,
        executor_factory: Optional[Callable[[str], object]] = None,
        model_detector: Optional[object] = None,
        hardware_detector: Optional[object] = None,
        state_store: Optional[LocalStateStore] = None,
        firebase_bootstrap_credits: float = 5.0,
        admin_emails: Optional[set[str]] = None,
    ) -> None:
        self.coordinator = coordinator or OllamaNetworkCoordinator()
        self._lock = threading.RLock()
        self._executor_factory = executor_factory or (lambda _worker_id: OllamaCommandExecutor())
        self._model_detector = model_detector or LocalOllamaModelDetector()
        self._hardware_detector = hardware_detector or LocalHardwareDetector()
        self._state_store = state_store or create_state_store(Path(__file__).resolve().parents[2])
        self._artifact_root = Path(__file__).resolve().parents[2] / ".runtime" / "generated"
        self._local_worker_loops: dict[str, dict[str, object]] = {}
        self._meta: dict[str, object] = {}
        self._firebase_bootstrap_credits = firebase_bootstrap_credits
        self._admin_emails = self._load_admin_emails(admin_emails)
        self._load_state()

    def register_user(
        self,
        user_id: str,
        starting_credits: float = 0.0,
        actor_user_id: Optional[str] = None,
        grant_starting_credits: Optional[bool] = None,
    ) -> dict[str, object]:
        self._assert_actor_matches(actor_user_id, user_id, "register a user")
        applied_starting_credits = (
            float(starting_credits)
            if (grant_starting_credits if grant_starting_credits is not None else float(starting_credits) > 0)
            else 0.0
        )
        with self._lock:
            if actor_user_id and self.coordinator.ledger.has_user(user_id):
                self._remember_user_locked(user_id)
                self._remember_local_operator_locked(user_id)
                self._persist_locked()
                return {
                    "user_id": user_id,
                    "balance": self.coordinator.ledger.balance_of(user_id),
                    "wallet": self.coordinator.ledger.wallet_snapshot(user_id),
                }
            self.coordinator.register_user(user_id=user_id, starting_credits=applied_starting_credits)
            self._remember_user_locked(user_id)
            self._remember_local_operator_locked(user_id)
            self._persist_locked()
            return {
                "user_id": user_id,
                "balance": self.coordinator.ledger.balance_of(user_id),
                "wallet": self.coordinator.ledger.wallet_snapshot(user_id),
            }

    def issue_user_identity(
        self,
        starting_credits: float = 0.0,
        actor_user_id: Optional[str] = None,
        grant_starting_credits: Optional[bool] = None,
    ) -> dict[str, object]:
        applied_starting_credits = (
            float(starting_credits)
            if (grant_starting_credits if grant_starting_credits is not None else float(starting_credits) > 0)
            else 0.0
        )
        with self._lock:
            if actor_user_id:
                if not self.coordinator.ledger.has_user(actor_user_id):
                    self.coordinator.register_user(
                        user_id=actor_user_id,
                        starting_credits=applied_starting_credits,
                    )
                self._remember_user_locked(actor_user_id)
                self._remember_local_operator_locked(actor_user_id)
                self._persist_locked()
                return {
                    "user_id": actor_user_id,
                    "balance": self.coordinator.ledger.balance_of(actor_user_id),
                    "issued": False,
                    "wallet": self.coordinator.ledger.wallet_snapshot(actor_user_id),
                }
            user_id = self._generate_user_id_locked()
            self.coordinator.register_user(user_id=user_id, starting_credits=applied_starting_credits)
            self._remember_user_locked(user_id)
            self._remember_local_operator_locked(user_id)
            self._persist_locked()
            return {
                "user_id": user_id,
                "balance": self.coordinator.ledger.balance_of(user_id),
                "issued": True,
                "wallet": self.coordinator.ledger.wallet_snapshot(user_id),
            }

    def register_worker(
        self,
        payload: dict[str, object],
        actor_user_id: Optional[str] = None,
    ) -> dict[str, object]:
        owner_user_id = str(payload["owner_user_id"])
        self._assert_actor_matches(actor_user_id, owner_user_id, "register a worker")
        worker = WorkerNode(
            worker_id=str(payload["worker_id"]),
            owner_user_id=owner_user_id,
            gpu_name=str(payload["gpu_name"]),
            vram_gb=float(payload["vram_gb"]),
            installed_models=set(payload["installed_models"]),
            benchmark_tokens_per_second={
                str(key): float(value)
                for key, value in dict(payload["benchmark_tokens_per_second"]).items()
            },
            system_ram_gb=float(payload.get("system_ram_gb", 0.0)),
            reliability_score=float(payload.get("reliability_score", 1.0)),
            public_pool=bool(payload.get("public_pool", True)),
            online=bool(payload.get("online", True)),
            max_concurrent_jobs=int(payload.get("max_concurrent_jobs", 1)),
            runtime=str(payload.get("runtime", "ollama")),
            allows_cloud_fallback=bool(payload.get("allows_cloud_fallback", False)),
        )
        with self._lock:
            self.coordinator.register_worker(worker)
            self._persist_locked()
            return self.coordinator.worker_snapshot(worker.worker_id)

    def submit_job(
        self,
        payload: dict[str, object],
        actor_user_id: Optional[str] = None,
    ) -> dict[str, object]:
        requester_user_id = str(payload.get("requester_user_id") or actor_user_id or "")
        self._assert_actor_matches(actor_user_id, requester_user_id, "submit a job")
        if not requester_user_id:
            raise ValueError("requester_user_id is required.")
        raw_prompt = str(payload["prompt"])
        with self._lock:
            conversation_id, conversation_turn, compiled_prompt = self._prepare_conversation_prompt_locked(
                requester_user_id=requester_user_id,
                prompt=raw_prompt,
                conversation_id=str(payload.get("conversation_id", "")),
            )
            record = self.coordinator.submit_job(
                requester_user_id=requester_user_id,
                model_tag=str(payload["model_tag"]),
                prompt=raw_prompt,
                compiled_prompt=compiled_prompt,
                max_output_tokens=int(payload["max_output_tokens"]),
                prompt_tokens=(
                    int(payload["prompt_tokens"])
                    if payload.get("prompt_tokens") is not None
                    else None
                ),
                privacy_tier=str(payload.get("privacy_tier", "public")),
                conversation_id=conversation_id,
                conversation_turn=conversation_turn,
            )
            self._append_conversation_message_locked(
                conversation_id=conversation_id,
                role="user",
                content=raw_prompt,
                job_id=record.request.job_id,
            )
            self._remember_user_locked(requester_user_id)
            self._persist_locked()
            snapshot = self.coordinator.job_snapshot(record.request.job_id)
            snapshot["conversation"] = self.get_conversation(conversation_id, actor_user_id=requester_user_id)
            return snapshot

    def claim_job_for_worker(
        self,
        worker_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
        allow_admin_self_serve: bool = False,
    ) -> Optional[dict[str, object]]:
        allow_own_jobs = False
        if allow_admin_self_serve:
            self._assert_admin_email(actor_email)
            allow_own_jobs = True
        with self._lock:
            worker = self.coordinator.workers.get(worker_id)
            if worker is None:
                raise KeyError(worker_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    worker.owner_user_id,
                    "claim jobs for this worker",
                )
            assignment = self.coordinator.claim_job_for_worker(
                worker_id,
                allow_own_jobs=allow_own_jobs,
            )
            if assignment is None:
                return None
            self._persist_locked()
            return self._assignment_payload(assignment)

    def complete_job(
        self,
        payload: dict[str, object],
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        result = JobResult(
            job_id=str(payload["job_id"]),
            worker_id=str(payload["worker_id"]),
            success=bool(payload["success"]),
            output_tokens=int(payload["output_tokens"]),
            latency_seconds=float(payload["latency_seconds"]),
            verified=bool(payload.get("verified", True)),
            prompt_tokens_used=int(payload.get("prompt_tokens_used", 0)),
            output_text=str(payload.get("output_text", "")),
            error_message=str(payload.get("error_message", "")),
        )
        with self._lock:
            worker = self.coordinator.workers.get(result.worker_id)
            if worker is None:
                raise KeyError(result.worker_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    worker.owner_user_id,
                    "complete jobs for this worker",
                )
            record = self.coordinator.complete_job(result)
            conversation_id = record.request.conversation_id
            if conversation_id:
                assistant_content = self._conversation_assistant_content(
                    result.output_text if result.success else (result.error_message or "Job failed."),
                    artifacts=self.coordinator.job_snapshot(record.request.job_id).get("artifacts", []),
                )
                self._append_conversation_message_locked(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=assistant_content,
                    job_id=record.request.job_id,
                    status=record.status.value,
                )
            self._persist_locked()
            snapshot = self.coordinator.job_snapshot(record.request.job_id)
            if conversation_id:
                snapshot["conversation"] = self.get_conversation(
                    conversation_id,
                    actor_user_id=record.request.requester_user_id,
                )
            return snapshot

    def get_job(
        self,
        job_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            payload = self._authorized_job_payload_locked(job_id, actor_user_id, actor_email)
            conversation_id = str(payload.get("conversation_id", ""))
            if conversation_id:
                payload["conversation"] = self._conversation_detail_locked(
                    dict(self._conversation_threads_locked().get(conversation_id, {}))
                )
            return payload

    def create_job_artifacts(
        self,
        job_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            payload = self._authorized_job_payload_locked(job_id, actor_user_id, actor_email)
            artifacts = list(payload.get("artifacts", []))
            created = materialize_artifacts(self._artifact_root, job_id, artifacts)
            self._persist_locked()
            return created

    def download_job_artifacts(
        self,
        job_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> tuple[str, bytes]:
        with self._lock:
            payload = self._authorized_job_payload_locked(job_id, actor_user_id, actor_email)
            artifacts = list(payload.get("artifacts", []))
            return zip_artifacts(job_id, artifacts)

    def get_user(
        self,
        user_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        if not self.is_admin_email(actor_email):
            self._assert_actor_matches(actor_user_id, user_id, "view this user")
        with self._lock:
            if not self.coordinator.ledger.has_user(user_id):
                raise KeyError(user_id)
            self._remember_user_locked(user_id)
            self._persist_locked()
            return {
                "user_id": user_id,
                "balance": self.coordinator.ledger.balance_of(user_id),
                "wallet": self.coordinator.ledger.wallet_snapshot(user_id),
            }

    def list_jobs(
        self,
        actor_user_id: str,
        actor_email: str = "",
        limit: int = 20,
    ) -> dict[str, object]:
        with self._lock:
            if not self.coordinator.ledger.has_user(actor_user_id):
                raise KeyError(actor_user_id)
            return {
                "user_id": actor_user_id,
                "is_admin": self.is_admin_email(actor_email),
                "jobs": self.coordinator.list_jobs_for_user(actor_user_id, limit=limit),
            }

    def list_conversations(self, actor_user_id: str) -> dict[str, object]:
        with self._lock:
            active_conversations = [
                self._conversation_summary_locked(thread)
                for thread in self._conversation_threads_locked().values()
                if str(thread.get("user_id", "")) == actor_user_id
                and not self._is_conversation_archived_locked(thread)
            ]
            archived_conversations = [
                self._conversation_summary_locked(thread)
                for thread in self._conversation_threads_locked().values()
                if str(thread.get("user_id", "")) == actor_user_id
                and self._is_conversation_archived_locked(thread)
            ]
            active_conversations.sort(
                key=lambda item: float(item.get("updated_at_unix", 0.0)),
                reverse=True,
            )
            archived_conversations.sort(
                key=lambda item: float(item.get("archived_at_unix", 0.0) or item.get("updated_at_unix", 0.0)),
                reverse=True,
            )
            return {
                "user_id": actor_user_id,
                "conversations": active_conversations,
                "archived_conversations": archived_conversations,
            }

    def get_conversation(
        self,
        conversation_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            thread = dict(self._conversation_threads_locked().get(conversation_id, {}))
            if not thread:
                raise KeyError(conversation_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    str(thread.get("user_id", "")),
                    "view this conversation",
                )
            return self._conversation_detail_locked(thread)

    def archive_conversation(
        self,
        conversation_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            thread = dict(self._conversation_threads_locked().get(conversation_id, {}))
            if not thread:
                raise KeyError(conversation_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    str(thread.get("user_id", "")),
                    "archive this conversation",
                )
            if not self._is_conversation_archived_locked(thread):
                thread["archived_at_unix"] = time()
                thread["updated_at_unix"] = float(thread.get("archived_at_unix", 0.0))
                self._conversation_threads_locked()[conversation_id] = thread
                self._persist_locked()
            return self._conversation_detail_locked(thread)

    def restore_conversation(
        self,
        conversation_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            thread = dict(self._conversation_threads_locked().get(conversation_id, {}))
            if not thread:
                raise KeyError(conversation_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    str(thread.get("user_id", "")),
                    "restore this conversation",
                )
            if self._is_conversation_archived_locked(thread):
                thread["archived_at_unix"] = 0.0
                thread["updated_at_unix"] = time()
                self._conversation_threads_locked()[conversation_id] = thread
                self._persist_locked()
            return self._conversation_detail_locked(thread)

    def get_wallet(self, actor_user_id: str) -> dict[str, object]:
        with self._lock:
            if not self.coordinator.ledger.has_user(actor_user_id):
                raise KeyError(actor_user_id)
            return self.coordinator.ledger.wallet_snapshot(actor_user_id)

    def get_ledger(self, actor_user_id: str) -> dict[str, object]:
        with self._lock:
            if not self.coordinator.ledger.has_user(actor_user_id):
                raise KeyError(actor_user_id)
            return {
                "user_id": actor_user_id,
                "entries": self.coordinator.ledger.ledger_entries_for_user(actor_user_id),
            }

    def get_admin_overview(self, actor_email: str) -> dict[str, object]:
        normalized_email = self._assert_admin_email(actor_email)
        with self._lock:
            bindings = self._firebase_bindings_locked()
            wallet_snapshots = self.coordinator.ledger.wallet_snapshots()
            worker_counts: dict[str, int] = {}
            online_worker_counts: dict[str, int] = {}
            job_counts: dict[str, int] = {}
            for worker in self.coordinator.workers.values():
                worker_counts[worker.owner_user_id] = worker_counts.get(worker.owner_user_id, 0) + 1
                if worker.online:
                    online_worker_counts[worker.owner_user_id] = online_worker_counts.get(worker.owner_user_id, 0) + 1
            for record in self.coordinator.jobs.values():
                requester_user_id = record.request.requester_user_id
                job_counts[requester_user_id] = job_counts.get(requester_user_id, 0) + 1

            latest_binding_by_user_id: dict[str, dict[str, object]] = {}
            accounts: list[dict[str, object]] = []
            now = time()
            for firebase_uid, binding in sorted(
                bindings.items(),
                key=lambda item: float(dict(item[1]).get("last_seen_unix", 0.0)),
                reverse=True,
            ):
                binding_payload = dict(binding)
                user_id = str(binding_payload.get("user_id", "")).strip()
                last_seen_unix = float(binding_payload.get("last_seen_unix", 0.0))
                wallet = (
                    self.coordinator.ledger.wallet_snapshot(user_id)
                    if user_id and self.coordinator.ledger.has_user(user_id)
                    else None
                )
                account = {
                    "firebase_uid": str(firebase_uid),
                    "email": str(binding_payload.get("email", "")),
                    "display_name": str(binding_payload.get("display_name", "")),
                    "picture": str(binding_payload.get("picture", "")),
                    "user_id": user_id,
                    "last_seen_unix": last_seen_unix,
                    "recently_active": (now - last_seen_unix) <= 900 if last_seen_unix else False,
                    "is_admin": self.is_admin_email(str(binding_payload.get("email", ""))),
                    "wallet": wallet,
                }
                accounts.append(account)
                if user_id and user_id not in latest_binding_by_user_id:
                    latest_binding_by_user_id[user_id] = account

            users: list[dict[str, object]] = []
            for user_id in sorted(
                wallet_id
                for wallet_id in wallet_snapshots.keys()
                if wallet_id != "platform_treasury"
            ):
                users.append(
                    {
                        "user_id": user_id,
                        "wallet": wallet_snapshots[user_id],
                        "firebase_account": latest_binding_by_user_id.get(user_id),
                        "worker_count": worker_counts.get(user_id, 0),
                        "online_worker_count": online_worker_counts.get(user_id, 0),
                        "job_count": job_counts.get(user_id, 0),
                    }
                )

            jobs = [
                self.coordinator.job_snapshot(job_id)
                for job_id in sorted(self.coordinator.jobs.keys(), reverse=True)
            ]
            workers = [
                self.coordinator.worker_snapshot(worker_id)
                for worker_id in sorted(self.coordinator.workers.keys())
            ]
            return {
                "actor_email": normalized_email,
                "summary": {
                    "known_firebase_accounts": len(accounts),
                    "recently_active_accounts": sum(1 for account in accounts if account["recently_active"]),
                    "known_network_users": len(users),
                    "online_workers": sum(1 for worker in workers if worker["online"]),
                    "queued_jobs": len(self.coordinator.snapshot().queued_jobs),
                    "total_jobs": len(jobs),
                },
                "admin_emails": sorted(self._admin_emails),
                "platform_wallet": wallet_snapshots.get("platform_treasury", {}),
                "accounts": accounts,
                "users": users,
                "workers": workers,
                "jobs": jobs[:100],
            }

    def admin_adjust_credits(
        self,
        target_user_id: str,
        amount: int,
        actor_email: str,
        note: str = "",
    ) -> dict[str, object]:
        normalized_email = self._assert_admin_email(actor_email)
        if amount == 0:
            raise ValueError("Credit adjustment cannot be zero.")
        sanitized_target = str(target_user_id).strip()
        if not sanitized_target:
            raise ValueError("target_user_id is required.")
        with self._lock:
            if not self.coordinator.ledger.has_user(sanitized_target):
                raise KeyError(sanitized_target)
            wallet_before = self.coordinator.ledger.wallet_snapshot(sanitized_target)
            available_before = int(wallet_before["available_credits"])
            if available_before + amount < 0:
                raise ValueError("Adjustment would make the user's available credits negative.")
            source = f"admin_adjustment:{normalized_email}"
            if note.strip():
                source = f"{source}:{note.strip()}"
            self.coordinator.ledger.adjust(
                user_id=sanitized_target,
                amount=amount,
                source=source,
            )
            self._persist_locked()
            entries = self.coordinator.ledger.ledger_entries_for_user(sanitized_target)
            latest_entry = entries[-1] if entries else None
            return {
                "user_id": sanitized_target,
                "amount": amount,
                "note": note.strip(),
                "actor_email": normalized_email,
                "wallet": self.coordinator.ledger.wallet_snapshot(sanitized_target),
                "entry": latest_entry,
            }

    def admin_cancel_job(
        self,
        job_id: str,
        actor_email: str,
        note: str = "",
    ) -> dict[str, object]:
        normalized_email = self._assert_admin_email(actor_email)
        with self._lock:
            record = self.coordinator.cancel_queued_job(
                job_id=job_id,
                reason=note.strip() or f"Canceled by admin {normalized_email}.",
            )
            self._persist_locked()
            return {
                "job": self.coordinator.job_snapshot(record.request.job_id),
                "actor_email": normalized_email,
            }

    def admin_reroute_job(
        self,
        job_id: str,
        model_tag: str,
        actor_email: str,
    ) -> dict[str, object]:
        normalized_email = self._assert_admin_email(actor_email)
        with self._lock:
            record = self.coordinator.reroute_queued_job(job_id=job_id, model_tag=model_tag)
            self._persist_locked()
            return {
                "job": self.coordinator.job_snapshot(record.request.job_id),
                "actor_email": normalized_email,
            }

    def admin_restart_failed_job(
        self,
        job_id: str,
        actor_email: str,
    ) -> dict[str, object]:
        normalized_email = self._assert_admin_email(actor_email)
        with self._lock:
            return self._restart_failed_job_locked(
                job_id=job_id,
                actor_user_id=None,
                actor_email=normalized_email,
            )

    def restart_failed_job(
        self,
        job_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            return self._restart_failed_job_locked(
                job_id=job_id,
                actor_user_id=actor_user_id,
                actor_email=actor_email,
            )

    def _restart_failed_job_locked(
        self,
        job_id: str,
        actor_user_id: Optional[str],
        actor_email: str,
    ) -> dict[str, object]:
        normalized_email = self._normalize_email(actor_email)
        record = self.coordinator.jobs.get(job_id)
        if record is None:
            raise KeyError(job_id)
        if record.status is not JobStatus.FAILED:
            raise PolicyError("Only failed jobs can be restarted.")
        if not self.is_admin_email(normalized_email):
            self._assert_actor_matches(
                actor_user_id,
                record.request.requester_user_id,
                "restart this job",
            )
        conversation_id, conversation_turn, compiled_prompt = self._prepare_conversation_prompt_locked(
            requester_user_id=record.request.requester_user_id,
            prompt=record.request.prompt,
            conversation_id=record.request.conversation_id,
        )
        restarted = self.coordinator.submit_job(
            requester_user_id=record.request.requester_user_id,
            model_tag=record.request.model_tag,
            prompt=record.request.prompt,
            compiled_prompt=compiled_prompt,
            max_output_tokens=record.request.max_output_tokens,
            prompt_tokens=record.request.prompt_tokens,
            privacy_tier=record.request.privacy_tier,
            conversation_id=conversation_id,
            conversation_turn=conversation_turn,
        )
        self._append_conversation_message_locked(
            conversation_id=conversation_id,
            role="user",
            content=record.request.prompt,
            job_id=restarted.request.job_id,
        )
        self._remember_user_locked(record.request.requester_user_id)
        self._persist_locked()
        return {
            "job": self.coordinator.job_snapshot(restarted.request.job_id),
            "restarted_from_job_id": job_id,
            "actor_email": normalized_email,
        }

    def purchase_credits(self, usd_amount: float, actor_user_id: str) -> dict[str, object]:
        credits = int(round(usd_amount * 100))
        if usd_amount <= 0 or credits <= 0:
            raise ValueError("usd_amount must be positive.")
        with self._lock:
            self.coordinator.register_user(user_id=actor_user_id)
            self.coordinator.ledger.purchase(
                user_id=actor_user_id,
                amount=credits,
                usd_amount=usd_amount,
            )
            self._remember_user_locked(actor_user_id)
            self._persist_locked()
            return {
                "user_id": actor_user_id,
                "usd_amount": usd_amount,
                "credits_added": credits,
                "wallet": self.coordinator.ledger.wallet_snapshot(actor_user_id),
            }

    def issue_worker_token(
        self,
        actor_user_id: str,
        label: str = "",
    ) -> dict[str, object]:
        normalized_user_id = str(actor_user_id or "").strip()
        if not normalized_user_id:
            raise ValueError("actor_user_id is required.")
        with self._lock:
            if not self.coordinator.ledger.has_user(normalized_user_id):
                raise KeyError(normalized_user_id)
            token_id = f"wkt_{uuid4().hex[:12]}"
            secret = secrets.token_urlsafe(24)
            raw_token = f"{token_id}.{secret}"
            registry = self._worker_tokens_locked()
            registry[token_id] = {
                "token_id": token_id,
                "user_id": normalized_user_id,
                "label": label.strip(),
                "secret_hash": self._hash_worker_token_secret(secret),
                "created_at_unix": time(),
                "last_used_unix": 0.0,
                "revoked_at_unix": 0.0,
            }
            self._persist_locked()
            return {
                "token": raw_token,
                "token_record": self._worker_token_public_locked(dict(registry[token_id])),
            }

    def list_worker_tokens(self, actor_user_id: str) -> dict[str, object]:
        normalized_user_id = str(actor_user_id or "").strip()
        if not normalized_user_id:
            raise ValueError("actor_user_id is required.")
        with self._lock:
            tokens = [
                self._worker_token_public_locked(dict(record))
                for record in self._worker_tokens_locked().values()
                if str(record.get("user_id", "")) == normalized_user_id
            ]
            tokens.sort(
                key=lambda item: (
                    float(item.get("revoked_at_unix", 0.0)),
                    float(item.get("created_at_unix", 0.0)),
                    str(item.get("token_id", "")),
                ),
                reverse=True,
            )
            return {
                "user_id": normalized_user_id,
                "tokens": tokens,
            }

    def revoke_worker_token(self, actor_user_id: str, token_id: str) -> dict[str, object]:
        normalized_user_id = str(actor_user_id or "").strip()
        normalized_token_id = str(token_id or "").strip()
        if not normalized_user_id:
            raise ValueError("actor_user_id is required.")
        if not normalized_token_id:
            raise ValueError("token_id is required.")
        with self._lock:
            registry = self._worker_tokens_locked()
            record = dict(registry.get(normalized_token_id, {}))
            if not record:
                raise KeyError(normalized_token_id)
            self._assert_actor_matches(
                normalized_user_id,
                str(record.get("user_id", "")),
                "revoke this worker token",
            )
            if float(record.get("revoked_at_unix", 0.0)) <= 0:
                record["revoked_at_unix"] = time()
                registry[normalized_token_id] = record
                self._persist_locked()
            return self._worker_token_public_locked(record)

    def authenticate_worker_token(self, raw_token: str) -> dict[str, object]:
        token = str(raw_token or "").strip()
        if not token or "." not in token:
            raise AuthenticationError("A valid worker token is required.")
        token_id, secret = token.split(".", maxsplit=1)
        if not token_id or not secret:
            raise AuthenticationError("A valid worker token is required.")
        with self._lock:
            record = dict(self._worker_tokens_locked().get(token_id, {}))
            if not record:
                raise AuthenticationError("That worker token is not recognized.")
            if float(record.get("revoked_at_unix", 0.0)) > 0:
                raise AuthenticationError("That worker token has been revoked.")
            expected_hash = str(record.get("secret_hash", ""))
            if not expected_hash or not hmac.compare_digest(
                expected_hash,
                self._hash_worker_token_secret(secret),
            ):
                raise AuthenticationError("That worker token is invalid.")
            user_id = str(record.get("user_id", "")).strip()
            if not user_id or not self.coordinator.ledger.has_user(user_id):
                raise AuthenticationError("That worker token is no longer bound to a valid user.")
            record["last_used_unix"] = time()
            self._worker_tokens_locked()[token_id] = record
            self._persist_locked()
            return {
                "token_id": token_id,
                "user_id": user_id,
                "label": str(record.get("label", "")),
            }

    def get_identity_context(self, actor_user_id: Optional[str] = None) -> dict[str, object]:
        with self._lock:
            wallets = self.coordinator.ledger.export_state().get("wallets", {})
            known_ids = sorted(str(user_id) for user_id in wallets.keys() if user_id != "platform_treasury")
            selected_user_id = actor_user_id or self._auto_selected_user_id_locked(known_ids)
            return {
                "last_active_user_id": self._meta.get("last_active_user_id"),
                "known_user_count": len(known_ids),
                "auto_selected_user_id": selected_user_id,
            }

    def get_worker_context(self, actor_user_id: Optional[str] = None) -> dict[str, object]:
        with self._lock:
            wallets = self.coordinator.ledger.export_state().get("wallets", {})
            known_ids = sorted(str(user_id) for user_id in wallets.keys() if user_id != "platform_treasury")
            selected_user_id = actor_user_id or self._auto_selected_user_id_locked(known_ids) or ""
            suggested_worker_id = self._suggested_worker_id_locked(selected_user_id)
            model_detection = self._model_detector.detect()
            hardware = self._hardware_detector.detect()
            available_vram_gb = hardware.primary_vram_gb if hardware.detected else 0.0
            available_system_ram_gb = hardware.system_ram_gb if hardware.detected else 0.0
            suggested_installed_models = list(model_detection.models)
            network_supported_local_models, model_selection_notes = self._classify_detected_models(
                suggested_installed_models,
                available_vram_gb=available_vram_gb,
                available_system_ram_gb=available_system_ram_gb,
            )
            unsupported_local_models = [
                item["tag"]
                for item in model_selection_notes
                if not bool(item.get("network_supported", False))
            ]
            suggested_benchmarks = {
                model_tag: self._default_tokens_per_second(model_tag)
                for model_tag in suggested_installed_models
            }
            return {
                "suggested_worker_id": suggested_worker_id,
                "suggested_owner_user_id": selected_user_id,
                "detection_scope": "api-server-host",
                "suggested_gpu_name": hardware.primary_gpu_name,
                "suggested_vram_gb": hardware.primary_vram_gb,
                "suggested_system_ram_gb": hardware.system_ram_gb,
                "suggested_installed_models": suggested_installed_models,
                "network_supported_local_models": network_supported_local_models,
                "unsupported_local_models": unsupported_local_models,
                "model_selection_notes": model_selection_notes,
                "excluded_local_models": model_selection_notes,
                "suggested_benchmark_tokens_per_second": suggested_benchmarks,
                "hardware_detection": {
                    "detected": hardware.detected,
                    "primary_gpu_name": hardware.primary_gpu_name,
                    "primary_vram_gb": hardware.primary_vram_gb,
                    "system_ram_gb": hardware.system_ram_gb,
                    "gpus": [
                        {
                            "name": gpu.name,
                            "vram_gb": gpu.vram_gb,
                            "source": gpu.source,
                        }
                        for gpu in hardware.gpus
                    ],
                    "error": hardware.error,
                },
            }

    def list_models(self) -> dict[str, object]:
        with self._lock:
            detection = self._model_detector.detect()
            approved_tags = set(self.coordinator.catalog.models.keys())
            return {
                "models": [
                    {
                        "tag": model.tag,
                        "family": model.family,
                        "min_vram_gb": model.min_vram_gb,
                        "quality_tier": model.quality_tier,
                        "strength_score": model.strength_score,
                        "runtime": model.runtime,
                        "installed_locally": model.tag in detection.models,
                    }
                    for model in self.coordinator.catalog.models.values()
                ],
                "quality_selectors": list(QUALITY_SELECTORS),
                "local_detection": {
                    "ollama_available": detection.ollama_available,
                    "error": detection.error,
                    "detected_models": detection.models,
                    "network_supported_local_models": [
                        model_tag for model_tag in detection.models if model_tag in approved_tags
                    ],
                    "unsupported_local_models": [
                        model_tag for model_tag in detection.models if model_tag not in approved_tags
                    ],
                    "approved_local_models": [
                        model_tag for model_tag in detection.models if model_tag in approved_tags
                    ],
                    "unapproved_local_models": [
                        model_tag for model_tag in detection.models if model_tag not in approved_tags
                    ],
                    "detection_scope": "api-server-host",
                },
            }

    def get_network(self) -> dict[str, object]:
        with self._lock:
            snapshot = self.coordinator.snapshot()
            return {
                "user_count": len(snapshot.users),
                "queued_jobs": snapshot.queued_jobs,
                "active_jobs": snapshot.active_jobs,
                "workers": {
                    worker_id: self.coordinator.worker_snapshot(worker_id)
                    for worker_id in self.coordinator.workers
                },
                "privacy": {
                    "balances_exposed": False,
                    "state_persisted_locally": self._state_store is not None,
                    "state_store_path": str(self._state_store.path) if self._state_store else "",
                },
                "local_workers": self._local_worker_statuses_locked(),
            }

    def get_worker_stats(
        self,
        worker_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
    ) -> dict[str, object]:
        with self._lock:
            if worker_id not in self.coordinator.workers:
                raise KeyError(worker_id)
            worker = self.coordinator.workers[worker_id]
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    worker.owner_user_id,
                    "view this worker's stats",
                )

            relevant_records = [
                record
                for record in self.coordinator.jobs.values()
                if record.assigned_worker_id == worker_id
            ]
            completed_records = [record for record in relevant_records if record.status.value == "completed"]
            failed_records = [record for record in relevant_records if record.status.value == "failed"]
            self_served_records = [
                record
                for record in completed_records
                if record.request.requester_user_id == worker.owner_user_id
            ]
            external_records = [
                record
                for record in completed_records
                if record.request.requester_user_id != worker.owner_user_id
            ]
            latency_values = [
                float(record.result.latency_seconds)
                for record in completed_records
                if record.result
            ]
            recent_jobs = sorted(
                (self.coordinator.job_snapshot(record.request.job_id) for record in relevant_records),
                key=lambda item: (
                    float(item.get("completed_at_unix", 0.0) or item.get("assigned_at_unix", 0.0) or item.get("submitted_at_unix", 0.0)),
                    str(item.get("job_id", "")),
                ),
                reverse=True,
            )[:8]
            model_counts: dict[str, int] = {}
            for record in completed_records:
                model_tag = record.resolved_model_tag or record.request.model_tag
                model_counts[model_tag] = model_counts.get(model_tag, 0) + 1
            top_models = [
                {"model_tag": model_tag, "jobs": count}
                for model_tag, count in sorted(
                    model_counts.items(),
                    key=lambda item: (-item[1], item[0]),
                )[:5]
            ]
            total_prompt_tokens = sum(int(record.prompt_tokens_used or 0) for record in completed_records)
            total_output_tokens = sum(
                int(record.result.output_tokens if record.result else 0)
                for record in completed_records
            )
            total_billed_tokens = sum(int(record.billed_tokens or 0) for record in completed_records)
            total_credits_earned = sum(int(record.worker_earned_credits or 0) for record in completed_records)
            total_final_credits = sum(int(record.actual_credits or 0) for record in completed_records)
            total_refunded_credits = sum(int(record.refunded_credits or 0) for record in relevant_records)
            local_loop = dict(self._local_worker_loops.get(worker_id, {}).get("status", {}))

            return {
                "worker": self.coordinator.worker_snapshot(worker_id),
                "local_loop": local_loop,
                "summary": {
                    "total_jobs_seen": len(relevant_records),
                    "completed_jobs": len(completed_records),
                    "failed_jobs": len(failed_records),
                    "self_served_jobs": len(self_served_records),
                    "external_jobs": len(external_records),
                    "credits_earned": total_credits_earned,
                    "credits_charged_to_requesters": total_final_credits,
                    "credits_refunded": total_refunded_credits,
                    "prompt_tokens_used": total_prompt_tokens,
                    "output_tokens_used": total_output_tokens,
                    "billed_tokens": total_billed_tokens,
                    "avg_latency_seconds": (
                        round(sum(latency_values) / len(latency_values), 3)
                        if latency_values
                        else 0.0
                    ),
                    "last_completed_at_unix": max(
                        (float(record.completed_at_unix or 0.0) for record in completed_records),
                        default=0.0,
                    ),
                    "owner_wallet_earned_credits": int(
                        self.coordinator.ledger.wallet_snapshot(worker.owner_user_id).get("earned_credits", 0)
                    ),
                },
                "top_models": top_models,
                "recent_jobs": recent_jobs,
            }

    def run_worker_cycle(
        self,
        worker_id: str,
        executor: Optional[object] = None,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
        allow_admin_self_serve: bool = False,
    ) -> Optional[dict[str, object]]:
        allow_own_jobs = False
        if allow_admin_self_serve:
            self._assert_admin_email(actor_email)
            allow_own_jobs = True
        with self._lock:
            worker = self.coordinator.workers.get(worker_id)
            if worker is None:
                raise KeyError(worker_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    worker.owner_user_id,
                    "run this worker",
                )
            assignment = self.coordinator.claim_job_for_worker(
                worker_id,
                allow_own_jobs=allow_own_jobs,
            )
            if assignment is None:
                return None
            selected_executor = executor or self._executor_factory(worker_id)
        try:
            execution: ExecutorResult = selected_executor.run(
                model_tag=assignment.model_tag,
                prompt=assignment.prompt,
                max_output_tokens=assignment.max_output_tokens,
            )
        except Exception as error:
            execution = ExecutorResult(
                success=False,
                output_text="",
                output_tokens=0,
                latency_seconds=0.0,
                verified=False,
                error_message=str(error),
            )
        result_payload = {
            "job_id": assignment.job_id,
            "worker_id": worker_id,
            "success": execution.success,
            "output_tokens": execution.output_tokens,
            "latency_seconds": execution.latency_seconds,
            "verified": execution.verified,
            "prompt_tokens_used": execution.prompt_tokens_used,
            "output_text": execution.output_text,
            "error_message": execution.error_message,
        }
        return self.complete_job(result_payload, actor_user_id=actor_user_id, actor_email=actor_email)

    def inspect_worker_queue(
        self,
        worker_id: str,
        actor_user_id: Optional[str] = None,
        actor_email: str = "",
        allow_admin_self_serve: bool = False,
    ) -> dict[str, object]:
        allow_own_jobs = False
        if allow_admin_self_serve:
            self._assert_admin_email(actor_email)
            allow_own_jobs = True
        with self._lock:
            worker = self.coordinator.workers.get(worker_id)
            if worker is None:
                raise KeyError(worker_id)
            if not self.is_admin_email(actor_email):
                self._assert_actor_matches(
                    actor_user_id,
                    worker.owner_user_id,
                    "inspect this worker queue",
                )
            return self.coordinator.explain_worker_queue(
                worker_id,
                allow_own_jobs=allow_own_jobs,
            )

    def start_local_worker(
        self,
        payload: dict[str, object],
        actor_user_id: Optional[str] = None,
    ) -> dict[str, object]:
        worker_id = str(payload["worker_id"])
        poll_interval_seconds = float(payload.get("poll_interval_seconds", 2.0))
        owner_user_id = str(payload["owner_user_id"])
        allow_admin_self_serve = bool(payload.get("allow_admin_self_serve", False))
        actor_email = str(payload.get("actor_email", ""))
        self._assert_actor_matches(actor_user_id, owner_user_id, "start a worker")
        if allow_admin_self_serve:
            actor_email = self._assert_admin_email(actor_email)
        with self._lock:
            self._remember_local_operator_locked(owner_user_id)
            worker_snapshot = self.register_worker(payload, actor_user_id=actor_user_id)
            existing = self._local_worker_loops.get(worker_id)
            if existing and existing["thread"].is_alive():
                existing["status"]["poll_interval_seconds"] = poll_interval_seconds
                existing["status"]["allow_admin_self_serve"] = allow_admin_self_serve
                existing["status"]["admin_actor_email"] = actor_email
                return {
                    "worker": worker_snapshot,
                    "loop": dict(existing["status"]),
                }
            stop_event = threading.Event()
            status = {
                "worker_id": worker_id,
                "running": True,
                "poll_interval_seconds": poll_interval_seconds,
                "started_at_unix": time(),
                "last_job_id": None,
                "last_result_status": "idle",
                "last_error": "",
                "jobs_completed": 0,
                "allow_admin_self_serve": allow_admin_self_serve,
                "admin_actor_email": actor_email,
                "last_idle_reason": "",
                "last_queue_summary": "",
                "compatible_queued_jobs": 0,
                "visible_queued_jobs": 0,
            }
            thread = threading.Thread(
                target=self._local_worker_loop,
                args=(worker_id, poll_interval_seconds, stop_event),
                daemon=True,
            )
            self._local_worker_loops[worker_id] = {
                "thread": thread,
                "stop_event": stop_event,
                "status": status,
            }
            thread.start()
            return {
                "worker": worker_snapshot,
                "queue": self.coordinator.explain_worker_queue(
                    worker_id,
                    allow_own_jobs=allow_admin_self_serve,
                ),
                "loop": dict(status),
            }

    def stop_local_worker(self, worker_id: str, actor_user_id: Optional[str] = None) -> dict[str, object]:
        with self._lock:
            session = self._local_worker_loops.get(worker_id)
            if worker_id in self.coordinator.workers:
                self._assert_actor_matches(
                    actor_user_id,
                    self.coordinator.workers[worker_id].owner_user_id,
                    "stop this worker",
                )
            if session is None:
                if worker_id in self.coordinator.workers:
                    self.coordinator.update_worker(worker_id, online=False)
                    self._persist_locked()
                return {
                    "worker_id": worker_id,
                    "running": False,
                    "last_error": "",
                }
            session["stop_event"].set()
            session["status"]["running"] = False
            session["status"]["stopped_at_unix"] = time()
            if worker_id in self.coordinator.workers:
                self.coordinator.update_worker(worker_id, online=False)
                self._persist_locked()
            return dict(session["status"])

    def get_authenticated_session(self, firebase_claims: dict[str, Any]) -> dict[str, object]:
        firebase_uid = str(firebase_claims["uid"])
        email = str(firebase_claims.get("email", ""))
        display_name = str(firebase_claims.get("name", ""))
        picture = str(firebase_claims.get("picture", ""))
        with self._lock:
            bindings = self._firebase_bindings_locked()
            binding = dict(bindings.get(firebase_uid, {}))
            user_id = str(binding.get("user_id", "")).strip()
            issued = False
            if not user_id or not self.coordinator.ledger.has_user(user_id):
                user_id = self._generate_user_id_locked()
                self.coordinator.register_user(
                    user_id=user_id,
                    starting_credits=self._firebase_bootstrap_credits,
                )
                issued = True
            bindings[firebase_uid] = {
                "user_id": user_id,
                "email": email,
                "display_name": display_name,
                "picture": picture,
                "last_seen_unix": time(),
            }
            self._remember_user_locked(user_id)
            self._remember_local_operator_locked(user_id)
            self._persist_locked()
            return {
                "firebase_uid": firebase_uid,
                "email": email,
                "display_name": display_name,
                "picture": picture,
                "user_id": user_id,
                "balance": self.coordinator.ledger.balance_of(user_id),
                "issued": issued,
                "wallet": self.coordinator.ledger.wallet_snapshot(user_id),
                "is_admin": self.is_admin_email(email),
            }

    @staticmethod
    def _assignment_payload(assignment: JobAssignment) -> dict[str, object]:
        return asdict(assignment)

    def _authorized_job_payload_locked(
        self,
        job_id: str,
        actor_user_id: Optional[str],
        actor_email: str,
    ) -> dict[str, object]:
        payload = self.coordinator.job_snapshot(job_id)
        if not self.is_admin_email(actor_email):
            self._assert_actor_matches(
                actor_user_id,
                str(payload.get("requester_user_id", "")),
                "view this job",
            )
        return payload

    def _load_state(self) -> None:
        if self._state_store is None:
            return
        payload = self._state_store.load()
        if payload:
            if "coordinator" in payload:
                self.coordinator.import_state(dict(payload.get("coordinator", {})))
                self._meta = dict(payload.get("meta", {}))
            else:
                self.coordinator.import_state(payload)
                self._meta = {}

    def _persist_locked(self) -> None:
        if self._state_store is None:
            return
        self._state_store.save(
            {
                "coordinator": self.coordinator.export_state(),
                "meta": dict(self._meta),
            }
        )

    def _generate_user_id_locked(self) -> str:
        known_ids = set(self.coordinator.ledger.export_state().get("wallets", {}).keys())
        while True:
            candidate = f"usr_{uuid4().hex[:12]}"
            if candidate not in known_ids:
                return candidate

    def _remember_user_locked(self, user_id: str) -> None:
        self._meta["last_active_user_id"] = user_id

    def _remember_local_operator_locked(self, user_id: str) -> None:
        self._meta["local_operator_user_id"] = user_id

    def _firebase_bindings_locked(self) -> dict[str, dict[str, object]]:
        bindings = self._meta.setdefault("firebase_users", {})
        if not isinstance(bindings, dict):
            bindings = {}
            self._meta["firebase_users"] = bindings
        return bindings

    def _conversation_threads_locked(self) -> dict[str, dict[str, object]]:
        threads = self._meta.setdefault("conversations", {})
        if not isinstance(threads, dict):
            threads = {}
            self._meta["conversations"] = threads
        return threads

    def _worker_tokens_locked(self) -> dict[str, dict[str, object]]:
        tokens = self._meta.setdefault("worker_tokens", {})
        if not isinstance(tokens, dict):
            tokens = {}
            self._meta["worker_tokens"] = tokens
        return tokens

    @staticmethod
    def _hash_worker_token_secret(secret: str) -> str:
        return hashlib.sha256(str(secret).encode("utf-8")).hexdigest()

    @staticmethod
    def _worker_token_public_locked(record: dict[str, object]) -> dict[str, object]:
        return {
            "token_id": str(record.get("token_id", "")),
            "user_id": str(record.get("user_id", "")),
            "label": str(record.get("label", "")),
            "created_at_unix": float(record.get("created_at_unix", 0.0)),
            "last_used_unix": float(record.get("last_used_unix", 0.0)),
            "revoked_at_unix": float(record.get("revoked_at_unix", 0.0)),
            "is_revoked": float(record.get("revoked_at_unix", 0.0)) > 0,
        }

    def _prepare_conversation_prompt_locked(
        self,
        requester_user_id: str,
        prompt: str,
        conversation_id: str,
    ) -> tuple[str, int, str]:
        threads = self._conversation_threads_locked()
        requested_id = conversation_id.strip()
        now = time()
        if requested_id:
            thread = dict(threads.get(requested_id, {}))
            if not thread:
                raise KeyError(requested_id)
            self._assert_actor_matches(
                requester_user_id,
                str(thread.get("user_id", "")),
                "continue this conversation",
            )
            if self._is_conversation_archived_locked(thread):
                raise PolicyError("Restore this conversation before adding new prompts to it.")
            messages = list(thread.get("messages", []))
            turn = 1 + sum(1 for item in messages if str(item.get("role", "")) == "user")
            compiled_prompt = self._render_conversation_prompt(messages, prompt)
            thread["updated_at_unix"] = now
            threads[requested_id] = thread
            return requested_id, turn, compiled_prompt
        new_id = f"cnv_{uuid4().hex[:12]}"
        threads[new_id] = {
            "conversation_id": new_id,
            "user_id": requester_user_id,
            "title": self._conversation_title(prompt),
            "created_at_unix": now,
            "updated_at_unix": now,
            "messages": [],
        }
        return new_id, 1, prompt

    def _append_conversation_message_locked(
        self,
        conversation_id: str,
        role: str,
        content: str,
        job_id: str = "",
        status: str = "",
    ) -> None:
        threads = self._conversation_threads_locked()
        thread = dict(threads.get(conversation_id, {}))
        if not thread:
            return
        messages = list(thread.get("messages", []))
        messages.append(
            {
                "message_id": f"msg_{uuid4().hex[:12]}",
                "role": role,
                "content": content,
                "job_id": job_id,
                "status": status,
                "timestamp_unix": time(),
            }
        )
        thread["messages"] = messages
        thread["updated_at_unix"] = time()
        threads[conversation_id] = thread

    @staticmethod
    def _conversation_title(prompt: str) -> str:
        trimmed = " ".join(prompt.split()).strip()
        if not trimmed:
            return "New conversation"
        return trimmed[:60] + ("..." if len(trimmed) > 60 else "")

    @staticmethod
    def _render_conversation_prompt(messages: list[dict[str, object]], prompt: str) -> str:
        recent = messages[-10:]
        lines = [
            "Continue the conversation below. Keep context from prior turns when helpful.",
            "",
        ]
        for item in recent:
            role = str(item.get("role", "")).strip().lower() or "message"
            content = str(item.get("content", "")).strip()
            if not content:
                continue
            label = "User" if role == "user" else "Assistant"
            lines.append(f"{label}: {content}")
        lines.append(f"User: {prompt}")
        lines.append("Assistant:")
        return "\n".join(lines)

    @staticmethod
    def _conversation_assistant_content(output_text: str, artifacts: Optional[list[dict[str, object]]] = None) -> str:
        text = str(output_text or "").strip()
        files = list(artifacts or []) or extract_job_artifacts(text)
        if not files:
            return text
        lines = []
        if text and len(text) <= 500:
            lines.append(text)
            lines.append("")
        lines.append("Generated files:")
        for artifact in files[:4]:
            path = str(artifact.get("path", "")).strip()
            content = str(artifact.get("content", "")).strip()
            if not path or not content:
                continue
            lines.append(f"[file: {path}]")
            lines.append(content)
            lines.append("")
        rendered = "\n".join(lines).strip()
        return rendered or text

    @staticmethod
    def _conversation_summary_locked(thread: dict[str, object]) -> dict[str, object]:
        messages = list(thread.get("messages", []))
        last_message = messages[-1] if messages else {}
        return {
            "conversation_id": str(thread.get("conversation_id", "")),
            "title": str(thread.get("title", "Conversation")),
            "user_id": str(thread.get("user_id", "")),
            "created_at_unix": float(thread.get("created_at_unix", 0.0)),
            "updated_at_unix": float(thread.get("updated_at_unix", 0.0)),
            "archived_at_unix": float(thread.get("archived_at_unix", 0.0)),
            "is_archived": float(thread.get("archived_at_unix", 0.0)) > 0,
            "message_count": len(messages),
            "last_message_preview": str(last_message.get("content", ""))[:80],
        }

    def _conversation_detail_locked(self, thread: dict[str, object]) -> dict[str, object]:
        return {
            "conversation_id": str(thread.get("conversation_id", "")),
            "title": str(thread.get("title", "Conversation")),
            "user_id": str(thread.get("user_id", "")),
            "created_at_unix": float(thread.get("created_at_unix", 0.0)),
            "updated_at_unix": float(thread.get("updated_at_unix", 0.0)),
            "archived_at_unix": float(thread.get("archived_at_unix", 0.0)),
            "is_archived": float(thread.get("archived_at_unix", 0.0)) > 0,
            "messages": list(thread.get("messages", [])),
        }

    @staticmethod
    def _is_conversation_archived_locked(thread: dict[str, object]) -> bool:
        return float(thread.get("archived_at_unix", 0.0)) > 0

    @staticmethod
    def _load_admin_emails(admin_emails: Optional[set[str]]) -> set[str]:
        configured = admin_emails
        if configured is None:
            env_value = os.environ.get("OLLAMA_NETWORK_ADMIN_EMAILS", "")
            configured = {
                email.strip().lower()
                for email in env_value.split(",")
                if email.strip()
            }
        configured = set(configured or set())
        configured.update(DEFAULT_ADMIN_EMAILS)
        return {
            email.strip().lower()
            for email in configured
            if email.strip()
        }

    @staticmethod
    def _normalize_email(email: str) -> str:
        return str(email or "").strip().lower()

    def is_admin_email(self, email: str) -> bool:
        return self._normalize_email(email) in self._admin_emails

    def _assert_admin_email(self, email: str) -> str:
        normalized = self._normalize_email(email)
        if not normalized or normalized not in self._admin_emails:
            raise AuthorizationError("Admin access is required for this action.")
        return normalized

    @staticmethod
    def _assert_actor_matches(
        actor_user_id: Optional[str],
        requested_user_id: str,
        action: str,
    ) -> None:
        if actor_user_id and requested_user_id and actor_user_id != requested_user_id:
            raise AuthorizationError(
                f"You can only {action} with your own network account."
            )

    def _auto_selected_user_id_locked(self, known_ids: list[str]) -> Optional[str]:
        local_operator = self._meta.get("local_operator_user_id")
        if isinstance(local_operator, str) and local_operator in known_ids:
            return local_operator
        last_active = self._meta.get("last_active_user_id")
        if isinstance(last_active, str) and last_active in known_ids:
            return last_active
        transactions = list(self.coordinator.ledger.export_state().get("transactions", []))
        for item in reversed(transactions):
            user_id = str(item.get("user_id", ""))
            if user_id.startswith("usr_") and user_id in known_ids:
                return user_id
        if len(known_ids) == 1:
            return known_ids[0]
        return None

    def _suggested_worker_id_locked(self, owner_user_id: str) -> str:
        if not owner_user_id:
            return ""
        existing = sorted(
            worker.worker_id
            for worker in self.coordinator.workers.values()
            if worker.owner_user_id == owner_user_id
        )
        if existing:
            return existing[0]
        normalized_owner = owner_user_id.replace("_", "-")
        return f"worker-{normalized_owner}"

    def _local_worker_statuses_locked(self) -> dict[str, dict[str, object]]:
        statuses: dict[str, dict[str, object]] = {}
        for worker_id, session in self._local_worker_loops.items():
            statuses[worker_id] = dict(session["status"])
            statuses[worker_id]["thread_alive"] = session["thread"].is_alive()
        return statuses

    def _local_worker_loop(
        self,
        worker_id: str,
        poll_interval_seconds: float,
        stop_event: threading.Event,
    ) -> None:
        executor = self._executor_factory(worker_id)
        while not stop_event.is_set():
            try:
                with self._lock:
                    session = self._local_worker_loops.get(worker_id)
                    allow_admin_self_serve = bool(session["status"].get("allow_admin_self_serve", False)) if session else False
                    actor_email = str(session["status"].get("admin_actor_email", "")) if session else ""
                result = self.run_worker_cycle(
                    worker_id,
                    executor=executor,
                    actor_email=actor_email,
                    allow_admin_self_serve=allow_admin_self_serve,
                )
                with self._lock:
                    session = self._local_worker_loops.get(worker_id)
                    if session is not None:
                        queue_state = self.coordinator.explain_worker_queue(
                            worker_id,
                            allow_own_jobs=allow_admin_self_serve,
                        )
                        session["status"]["running"] = True
                        session["status"]["last_error"] = ""
                        session["status"]["last_polled_unix"] = time()
                        session["status"]["last_queue_summary"] = str(queue_state.get("summary", ""))
                        session["status"]["compatible_queued_jobs"] = int(queue_state.get("compatible_jobs", 0))
                        session["status"]["visible_queued_jobs"] = int(queue_state.get("queued_jobs", 0))
                        if result is None:
                            session["status"]["last_result_status"] = "idle"
                            session["status"]["last_idle_reason"] = str(queue_state.get("summary", ""))
                        else:
                            session["status"]["last_job_id"] = result["job_id"]
                            session["status"]["last_result_status"] = result["status"]
                            session["status"]["last_idle_reason"] = ""
                            if result["status"] == "completed":
                                session["status"]["jobs_completed"] += 1
            except Exception as error:
                with self._lock:
                    session = self._local_worker_loops.get(worker_id)
                    if session is not None:
                        session["status"]["running"] = True
                        session["status"]["last_error"] = str(error)
                        session["status"]["last_result_status"] = "error"
                        session["status"]["last_polled_unix"] = time()
            stop_event.wait(poll_interval_seconds)

    @staticmethod
    def _default_tokens_per_second(model_tag: str) -> float:
        numeric_chunks = [
            int(chunk.rstrip("b"))
            for chunk in model_tag.replace(":", "-").split("-")
            if chunk.endswith("b") and chunk[:-1].isdigit()
        ]
        if not numeric_chunks:
            return 24.0
        size = numeric_chunks[0]
        if size <= 4:
            return 72.0
        if size <= 9:
            return 48.0
        if size <= 20:
            return 24.0
        return 12.0

    def _classify_detected_models(
        self,
        detected_models: list[str],
        available_vram_gb: float,
        available_system_ram_gb: float = 0.0,
    ) -> tuple[list[str], list[dict[str, object]]]:
        network_supported_local_models: list[str] = []
        notes: list[dict[str, object]] = []
        for model_tag in detected_models:
            catalog_model = self.coordinator.catalog.models.get(model_tag)
            if catalog_model is None:
                notes.append(
                    {
                        "tag": model_tag,
                        "reason": "Detected on this host. You can advertise it, but the network will not route exact-tag jobs to it until catalog metadata is added.",
                        "network_supported": False,
                    }
                )
                continue
            network_supported_local_models.append(model_tag)
            if available_vram_gb and catalog_model.min_vram_gb > available_vram_gb:
                notes.append(
                    {
                        "tag": model_tag,
                        "reason": f"Catalog target is {catalog_model.min_vram_gb:g} GB dedicated VRAM, but this worker reports {available_vram_gb:g} GB. Ollama may still run it using shared memory or RAM, but performance can be much slower.",
                        "network_supported": True,
                    }
                )
            required_system_ram_gb = catalog_model.estimated_system_ram_gb()
            if available_system_ram_gb and required_system_ram_gb > available_system_ram_gb:
                notes.append(
                    {
                        "tag": model_tag,
                        "reason": f"Catalog target typically needs about {required_system_ram_gb:g} GB host RAM, but this worker reports {available_system_ram_gb:g} GB. The network will avoid assigning oversized jobs here.",
                        "network_supported": True,
                    }
                )
        return network_supported_local_models, notes


def handle_policy_error(error: PolicyError) -> tuple[int, dict[str, str]]:
    return 400, {"error": str(error)}
