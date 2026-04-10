from __future__ import annotations

from dataclasses import asdict
from time import time
from uuid import uuid4

from .models import CreditHold, CreditTransaction, LedgerEntryType, UserWallet

PLATFORM_WALLET_ID = "platform_treasury"
WORKER_SHARE_RATIO = 0.70


class CreditLedger:
    """Tracks wallet balances, pending holds, and typed credit ledger entries."""

    def __init__(self) -> None:
        self._wallets: dict[str, UserWallet] = {}
        self._holds: dict[str, CreditHold] = {}
        self._transactions: list[CreditTransaction] = []

    def register_user(self, user_id: str, starting_credits: int = 0) -> None:
        wallet = self._ensure_wallet(user_id)
        if starting_credits > 0 and wallet.available_credits == 0 and wallet.spent_credits == 0:
            self.adjust(
                user_id=user_id,
                amount=starting_credits,
                source="bootstrap_credits",
            )

    def has_user(self, user_id: str) -> bool:
        return user_id in self._wallets

    def balance_of(self, user_id: str) -> int:
        return self._ensure_wallet(user_id).available_credits

    def wallet_snapshot(self, user_id: str) -> dict[str, object]:
        wallet = self._ensure_wallet(user_id)
        pending_credits = sum(
            hold.amount
            for hold in self._holds.values()
            if hold.user_id == user_id
        )
        return {
            "user_id": wallet.user_id,
            "available_credits": wallet.available_credits,
            "pending_credits": pending_credits,
            "spent_credits": wallet.spent_credits,
            "earned_credits": wallet.earned_credits,
            "created_at": wallet.created_at_unix,
        }

    def wallet_snapshots(self) -> dict[str, dict[str, object]]:
        return {
            user_id: self.wallet_snapshot(user_id)
            for user_id in self._wallets
        }

    def reserve(self, user_id: str, job_id: str, amount: int) -> None:
        if amount <= 0:
            raise ValueError("Reservation amount must be positive.")
        wallet = self._ensure_wallet(user_id)
        if wallet.available_credits < amount:
            raise ValueError(
                f"User '{user_id}' has {wallet.available_credits} credits, which is not enough to reserve {amount}."
            )
        wallet.available_credits -= amount
        self._holds[job_id] = CreditHold(
            job_id=job_id,
            user_id=user_id,
            amount=amount,
            created_at_unix=time(),
        )
        self._record_transaction(
            user_id=user_id,
            entry_type=LedgerEntryType.SPEND,
            amount=-amount,
            source="job_reservation",
            job_id=job_id,
            pending=True,
        )

    def purchase(self, user_id: str, amount: int, usd_amount: float) -> None:
        if amount <= 0:
            raise ValueError("Purchased credits must be positive.")
        wallet = self._ensure_wallet(user_id)
        wallet.available_credits += amount
        self._record_transaction(
            user_id=user_id,
            entry_type=LedgerEntryType.PURCHASE,
            amount=amount,
            source=f"usd_purchase:{usd_amount:.2f}",
        )

    def adjust(self, user_id: str, amount: int, source: str) -> None:
        if amount == 0:
            return
        wallet = self._ensure_wallet(user_id)
        wallet.available_credits += amount
        self._record_transaction(
            user_id=user_id,
            entry_type=LedgerEntryType.ADJUSTMENT,
            amount=amount,
            source=source,
        )

    def release(self, job_id: str, source: str) -> int:
        hold = self._holds.pop(job_id)
        self._drop_pending_reservation(job_id=job_id, user_id=hold.user_id)
        wallet = self._ensure_wallet(hold.user_id)
        wallet.available_credits += hold.amount
        self._record_transaction(
            user_id=hold.user_id,
            entry_type=LedgerEntryType.REFUND,
            amount=hold.amount,
            source=source,
            job_id=job_id,
        )
        return hold.amount

    def settle(self, job_id: str, worker_user_id: str, final_cost: int) -> tuple[int, int, int, int]:
        hold = self._holds.pop(job_id)
        if final_cost < 0 or final_cost > hold.amount:
            raise ValueError("Final cost must be between zero and the reserved credits.")
        self._drop_pending_reservation(job_id=job_id, user_id=hold.user_id)

        requester_wallet = self._ensure_wallet(hold.user_id)
        worker_wallet = self._ensure_wallet(worker_user_id)
        platform_wallet = self._ensure_wallet(PLATFORM_WALLET_ID)

        refund = hold.amount - final_cost
        worker_share = 0 if final_cost == 0 else max(1, int(final_cost * WORKER_SHARE_RATIO))
        worker_share = min(worker_share, final_cost)
        platform_share = final_cost - worker_share

        requester_wallet.spent_credits += final_cost
        worker_wallet.available_credits += worker_share
        worker_wallet.earned_credits += worker_share
        platform_wallet.available_credits += platform_share
        platform_wallet.earned_credits += platform_share
        if refund:
            requester_wallet.available_credits += refund

        self._record_transaction(
            user_id=hold.user_id,
            entry_type=LedgerEntryType.SPEND,
            amount=-final_cost,
            source="job_execution",
            job_id=job_id,
        )
        if refund:
            self._record_transaction(
                user_id=hold.user_id,
                entry_type=LedgerEntryType.REFUND,
                amount=refund,
                source="unused_reserved_credits",
                job_id=job_id,
            )
        if worker_share:
            self._record_transaction(
                user_id=worker_user_id,
                entry_type=LedgerEntryType.EARN,
                amount=worker_share,
                source="job_execution",
                job_id=job_id,
            )
        if platform_share:
            self._record_transaction(
                user_id=PLATFORM_WALLET_ID,
                entry_type=LedgerEntryType.ADJUSTMENT,
                amount=platform_share,
                source="platform_fee",
                job_id=job_id,
            )
        return final_cost, refund, worker_share, platform_share

    def ledger_entries_for_user(self, user_id: str) -> list[dict[str, object]]:
        entries: list[dict[str, object]] = []
        for entry in self._transactions:
            if entry.user_id != user_id:
                continue
            payload = asdict(entry)
            payload["entry_type"] = entry.entry_type.value
            entries.append(payload)
        return entries

    @property
    def transactions(self) -> list[CreditTransaction]:
        return list(self._transactions)

    def export_state(self) -> dict[str, object]:
        return {
            "wallets": {
                user_id: {
                    "user_id": wallet.user_id,
                    "available_credits": wallet.available_credits,
                    "spent_credits": wallet.spent_credits,
                    "earned_credits": wallet.earned_credits,
                    "created_at_unix": wallet.created_at_unix,
                }
                for user_id, wallet in self._wallets.items()
            },
            "holds": {
                job_id: {
                    "job_id": hold.job_id,
                    "user_id": hold.user_id,
                    "amount": hold.amount,
                    "created_at_unix": hold.created_at_unix,
                }
                for job_id, hold in self._holds.items()
            },
            "transactions": [
                {
                    "entry_id": entry.entry_id,
                    "user_id": entry.user_id,
                    "entry_type": entry.entry_type.value,
                    "amount": entry.amount,
                    "source": entry.source,
                    "job_id": entry.job_id,
                    "timestamp_unix": entry.timestamp_unix,
                    "pending": entry.pending,
                }
                for entry in self._transactions
            ],
        }

    def import_state(self, payload: dict[str, object]) -> None:
        wallets_payload = dict(payload.get("wallets", {}))
        if wallets_payload:
            self._wallets = {
                str(user_id): UserWallet(
                    user_id=str(wallet.get("user_id", user_id)),
                    available_credits=int(wallet.get("available_credits", 0)),
                    spent_credits=int(wallet.get("spent_credits", 0)),
                    earned_credits=int(wallet.get("earned_credits", 0)),
                    created_at_unix=float(wallet.get("created_at_unix", 0.0)),
                )
                for user_id, wallet in wallets_payload.items()
                if str(user_id).strip()
            }
        else:
            legacy_balances = dict(payload.get("balances", {}))
            self._wallets = {
                str(user_id): UserWallet(
                    user_id=str(user_id),
                    available_credits=int(round(float(balance))),
                    created_at_unix=0.0,
                )
                for user_id, balance in legacy_balances.items()
                if str(user_id).strip()
            }
            # Best-effort migration for legacy totals when only balances existed.
            for entry in list(payload.get("transactions", [])):
                user_id = str(entry.get("user_id", "")).strip()
                if not user_id or user_id not in self._wallets:
                    continue
                delta = int(round(float(entry.get("delta", 0.0))))
                reason = str(entry.get("reason", ""))
                wallet = self._wallets[user_id]
                if delta > 0 and "served public" in reason:
                    wallet.earned_credits += delta
                elif delta < 0 and "reservation" in reason:
                    wallet.spent_credits += abs(delta)

        self._holds = {
            str(job_id): CreditHold(
                job_id=str(hold["job_id"]),
                user_id=str(hold["user_id"]),
                amount=int(round(float(hold["amount"]))),
                created_at_unix=float(hold.get("created_at_unix", 0.0)),
            )
            for job_id, hold in dict(payload.get("holds", {})).items()
            if str(hold.get("user_id", "")).strip()
        }

        self._transactions = [
            self._transaction_from_payload(item)
            for item in list(payload.get("transactions", []))
            if str(item.get("user_id", "")).strip()
        ]

    def _ensure_wallet(self, user_id: str) -> UserWallet:
        wallet = self._wallets.get(user_id)
        if wallet is None:
            wallet = UserWallet(user_id=user_id, created_at_unix=time())
            self._wallets[user_id] = wallet
        return wallet

    def _record_transaction(
        self,
        user_id: str,
        entry_type: LedgerEntryType,
        amount: int,
        source: str,
        job_id: str = "",
        pending: bool = False,
    ) -> None:
        self._transactions.append(
            CreditTransaction(
                entry_id=f"led_{uuid4().hex[:12]}",
                user_id=user_id,
                entry_type=entry_type,
                amount=int(amount),
                source=source,
                job_id=job_id,
                timestamp_unix=time(),
                pending=pending,
            )
        )

    def _drop_pending_reservation(self, job_id: str, user_id: str) -> None:
        self._transactions = [
            entry
            for entry in self._transactions
            if not (
                entry.job_id == job_id
                and entry.user_id == user_id
                and entry.pending
                and entry.entry_type is LedgerEntryType.SPEND
                and entry.source == "job_reservation"
            )
        ]

    @staticmethod
    def _transaction_from_payload(item: dict[str, object]) -> CreditTransaction:
        legacy_reason = str(item.get("reason", ""))
        entry_type_raw = str(item.get("entry_type", "")).strip()
        if entry_type_raw:
            entry_type = LedgerEntryType(entry_type_raw)
            amount = int(round(float(item.get("amount", 0))))
            source = str(item.get("source", item.get("reason", "legacy")))
        else:
            delta = int(round(float(item.get("delta", 0.0))))
            amount = delta
            source = legacy_reason or "legacy"
            normalized_reason = legacy_reason.lower()
            if "bootstrap credits" in normalized_reason:
                entry_type = LedgerEntryType.ADJUSTMENT
            elif "job reservation" in normalized_reason:
                entry_type = LedgerEntryType.SPEND
            elif "unused reserved credits" in normalized_reason or "refund" in normalized_reason:
                entry_type = LedgerEntryType.REFUND
            elif "served public" in normalized_reason:
                entry_type = LedgerEntryType.EARN
            else:
                entry_type = LedgerEntryType.ADJUSTMENT
        return CreditTransaction(
            entry_id=str(item.get("entry_id", f"led_{uuid4().hex[:12]}")),
            user_id=str(item["user_id"]),
            entry_type=entry_type,
            amount=amount,
            source=source,
            job_id=str(item.get("job_id", item.get("reference_id", ""))),
            timestamp_unix=float(item.get("timestamp_unix", 0.0)),
            pending=bool(item.get("pending", False)),
        )
