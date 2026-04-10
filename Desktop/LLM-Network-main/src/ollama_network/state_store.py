from __future__ import annotations

import json
import os
from pathlib import Path
from time import sleep
from typing import Optional, Protocol, Union


class StateStore(Protocol):
    def load(self) -> Optional[dict[str, object]]: ...

    def save(self, payload: dict[str, object]) -> None: ...


class LocalStateStore:
    """Persists coordinator state to a local JSON file that is never served by the API."""

    def __init__(self, path: Union[str, Path]) -> None:
        self.path = Path(path)

    def load(self) -> Optional[dict[str, object]]:
        if not self.path.exists():
            return None
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, payload: dict[str, object]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_suffix(f"{self.path.suffix}.tmp")
        encoded = json.dumps(payload, indent=2)
        temp_path.write_text(encoded, encoding="utf-8")
        for _ in range(3):
            try:
                temp_path.replace(self.path)
                return
            except PermissionError:
                sleep(0.05)
        # Fall back to a direct write when Windows or sync clients briefly lock replace().
        self.path.write_text(encoded, encoding="utf-8")
        if temp_path.exists():
            temp_path.unlink()


class FirestoreStateStore:
    """Persists coordinator state in a shared Firestore document."""

    def __init__(
        self,
        collection: str,
        document: str,
        project_id: str = "",
        client: Optional[object] = None,
    ) -> None:
        self.collection = collection
        self.document = document
        self.project_id = project_id
        if client is None:
            try:
                from google.cloud import firestore
            except ImportError as error:
                raise RuntimeError(
                    "Firestore state backend requires the 'google-cloud-firestore' package."
                ) from error
            client = firestore.Client(project=project_id or None)
        self._client = client
        self._doc = self._client.collection(collection).document(document)

    def load(self) -> Optional[dict[str, object]]:
        snapshot = self._doc.get()
        exists = getattr(snapshot, "exists", False)
        if not exists:
            return None
        payload = snapshot.to_dict() or {}
        state = payload.get("state")
        return dict(state) if isinstance(state, dict) else None

    def save(self, payload: dict[str, object]) -> None:
        self._doc.set(
            {
                "state": payload,
            }
        )


def create_state_store(project_root: Path) -> StateStore:
    backend = os.environ.get("OLLAMA_NETWORK_STATE_BACKEND", "local").strip().lower()
    if backend == "firestore":
        return FirestoreStateStore(
            collection=os.environ.get("OLLAMA_NETWORK_FIRESTORE_COLLECTION", "ollama_network_state"),
            document=os.environ.get("OLLAMA_NETWORK_FIRESTORE_DOCUMENT", "shared"),
            project_id=os.environ.get("OLLAMA_NETWORK_FIRESTORE_PROJECT_ID", ""),
        )
    return LocalStateStore(project_root / ".runtime" / "private_state.json")
