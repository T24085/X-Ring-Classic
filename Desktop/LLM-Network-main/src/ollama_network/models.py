from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from math import ceil
from typing import Optional


class PolicyError(ValueError):
    """Raised when a job or worker violates the reciprocal local-only network rules."""


class AuthorizationError(PermissionError):
    """Raised when an authenticated user tries to act as a different network identity."""


class JobStatus(str, Enum):
    QUEUED = "queued"
    ASSIGNED = "assigned"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"


class LedgerEntryType(str, Enum):
    PURCHASE = "purchase"
    SPEND = "spend"
    EARN = "earn"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


@dataclass(frozen=True)
class ModelDefinition:
    tag: str
    family: str
    min_vram_gb: float
    input_credit_rate: float = 0.0
    output_credit_rate: float = 0.0
    quality_tier: str = "better"
    pricing_tier: str = "tier_2_standard"
    credit_multiplier: float = 1.5
    strength_score: float = 50.0
    runtime: str = "ollama"
    local_only: bool = True
    supports_public_pool: bool = True

    def estimate_credits(self, prompt_tokens: int, output_tokens: int) -> int:
        billed_units = max(1, ceil((max(prompt_tokens, 0) + max(output_tokens, 0)) / 1000))
        return max(1, ceil(billed_units * self.credit_multiplier))

    def estimated_system_ram_gb(self) -> float:
        """
        Return a conservative host RAM floor for this model.

        Ollama can spill into shared memory or CPU RAM when VRAM is thin, so we
        keep a small safety margin above the catalog VRAM minimum instead of
        treating the raw catalog floor as exact.
        """
        return round(max(self.min_vram_gb + 1.0, self.min_vram_gb * 1.1), 1)


@dataclass
class WorkerNode:
    worker_id: str
    owner_user_id: str
    gpu_name: str
    vram_gb: float
    installed_models: set[str]
    benchmark_tokens_per_second: dict[str, float]
    system_ram_gb: float = 0.0
    reliability_score: float = 1.0
    public_pool: bool = True
    online: bool = True
    max_concurrent_jobs: int = 1
    runtime: str = "ollama"
    allows_cloud_fallback: bool = False
    active_jobs: int = 0
    last_heartbeat_unix: Optional[float] = None

    def effective_host_ram_gb(self) -> float:
        return self.system_ram_gb if self.system_ram_gb > 0.0 else self.vram_gb

    def supports_model(self, model: ModelDefinition) -> bool:
        required_system_ram_gb = model.estimated_system_ram_gb()
        available_host_ram_gb = self.effective_host_ram_gb()
        return (
            self.online
            and self.public_pool
            and self.runtime == "ollama"
            and not self.allows_cloud_fallback
            and model.tag in self.installed_models
            and self.benchmark_tokens_per_second.get(model.tag, 0.0) > 0.0
            and self.active_jobs < self.max_concurrent_jobs
            and available_host_ram_gb >= required_system_ram_gb
        )


@dataclass(frozen=True)
class JobRequest:
    job_id: str
    requester_user_id: str
    model_tag: str
    prompt: str
    compiled_prompt: str
    prompt_tokens: int
    max_output_tokens: int
    privacy_tier: str = "public"
    submitted_at_unix: float = 0.0
    conversation_id: str = ""
    conversation_turn: int = 0


@dataclass(frozen=True)
class JobAssignment:
    job_id: str
    worker_id: str
    model_tag: str
    reserved_credits: int
    prompt: str
    prompt_tokens: int
    max_output_tokens: int


@dataclass(frozen=True)
class JobResult:
    job_id: str
    worker_id: str
    success: bool
    output_tokens: int
    latency_seconds: float
    verified: bool
    prompt_tokens_used: int = 0
    output_text: str = ""
    error_message: str = ""


@dataclass
class JobRecord:
    request: JobRequest
    reserved_credits: int
    status: JobStatus = JobStatus.QUEUED
    assigned_worker_id: Optional[str] = None
    resolved_model_tag: Optional[str] = None
    assigned_at_unix: float = 0.0
    completed_at_unix: float = 0.0
    actual_credits: int = 0
    prompt_tokens_used: int = 0
    billed_tokens: int = 0
    worker_earned_credits: int = 0
    platform_fee_credits: int = 0
    refunded_credits: int = 0
    result: Optional[JobResult] = None


@dataclass(frozen=True)
class CreditHold:
    job_id: str
    user_id: str
    amount: int
    created_at_unix: float = 0.0


@dataclass
class UserWallet:
    user_id: str
    available_credits: int = 0
    spent_credits: int = 0
    earned_credits: int = 0
    created_at_unix: float = 0.0


@dataclass(frozen=True)
class CreditTransaction:
    entry_id: str
    user_id: str
    entry_type: LedgerEntryType
    amount: int
    source: str
    job_id: str = ""
    timestamp_unix: float = 0.0
    pending: bool = False


@dataclass
class NetworkSnapshot:
    users: dict[str, int]
    queued_jobs: list[str]
    active_jobs: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class ExecutorResult:
    success: bool
    output_text: str
    output_tokens: int
    latency_seconds: float
    prompt_tokens_used: int = 0
    verified: bool = True
    error_message: str = ""
