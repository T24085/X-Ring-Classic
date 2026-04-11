from __future__ import annotations

from ollama_network.service import NetworkService
from ollama_network.state_store import FirestoreStateStore, LocalStateStore


def test_private_state_persists_issued_identity_and_balance(tmp_path) -> None:
    store = LocalStateStore(tmp_path / "private_state.json")

    service = NetworkService(state_store=store)
    issued = service.issue_user_identity(starting_credits=7.0)
    user_id = issued["user_id"]

    reloaded = NetworkService(state_store=store)
    loaded = reloaded.get_user(user_id)
    context = reloaded.get_identity_context()

    assert loaded["user_id"] == user_id
    assert loaded["balance"] == 7.0
    assert context["auto_selected_user_id"] == user_id


class _FakeDocSnapshot:
    def __init__(self, payload):
        self._payload = payload
        self.exists = payload is not None

    def to_dict(self):
        return self._payload


class _FakeDocRef:
    def __init__(self) -> None:
        self.payload = None

    def get(self):
        return _FakeDocSnapshot(self.payload)

    def set(self, payload):
        self.payload = payload


class _FakeCollection:
    def __init__(self, doc_ref) -> None:
        self._doc_ref = doc_ref

    def document(self, _document):
        return self._doc_ref


class _FakeFirestoreClient:
    def __init__(self, doc_ref) -> None:
        self._doc_ref = doc_ref

    def collection(self, _collection):
        return _FakeCollection(self._doc_ref)


def test_firestore_state_store_round_trips_payload() -> None:
    doc_ref = _FakeDocRef()
    store = FirestoreStateStore(
        collection="ollama_network_state",
        document="shared",
        client=_FakeFirestoreClient(doc_ref),
    )

    payload = {"coordinator": {"jobs": {}}, "meta": {"conversations": {"cnv_1": {"title": "Hello"}}}}
    store.save(payload)

    assert store.load() == payload
