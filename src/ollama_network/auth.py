from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class AuthenticationError(PermissionError):
    """Raised when a request is missing or carries an invalid Firebase token."""


@dataclass(frozen=True)
class FirebaseProjectConfig:
    api_key: str
    auth_domain: str
    project_id: str
    storage_bucket: str
    messaging_sender_id: str
    app_id: str

    def to_web_dict(self) -> dict[str, str]:
        return {
            "apiKey": self.api_key,
            "authDomain": self.auth_domain,
            "projectId": self.project_id,
            "storageBucket": self.storage_bucket,
            "messagingSenderId": self.messaging_sender_id,
            "appId": self.app_id,
        }

    def to_web_json(self) -> str:
        return json.dumps(self.to_web_dict())


_DEFAULT_FIREBASE_WEB_CONFIG = {
    "api_key": "",
    "auth_domain": "llm-network.firebaseapp.com",
    "project_id": "llm-network",
    "storage_bucket": "llm-network.firebasestorage.app",
    "messaging_sender_id": "502332096634",
    "app_id": "1:502332096634:web:bc43239838ae06ef197bc3",
}


def _firebase_local_config_path() -> Path:
    return Path(__file__).resolve().parents[2] / ".runtime" / "firebase.local.json"


def _load_local_firebase_project_config() -> dict[str, str]:
    path = _firebase_local_config_path()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    aliases = {
        "api_key": "api_key",
        "apiKey": "api_key",
        "auth_domain": "auth_domain",
        "authDomain": "auth_domain",
        "project_id": "project_id",
        "projectId": "project_id",
        "storage_bucket": "storage_bucket",
        "storageBucket": "storage_bucket",
        "messaging_sender_id": "messaging_sender_id",
        "messagingSenderId": "messaging_sender_id",
        "app_id": "app_id",
        "appId": "app_id",
    }
    normalized: dict[str, str] = {}
    for key, value in payload.items():
        mapped = aliases.get(str(key))
        if not mapped:
            continue
        normalized[mapped] = str(value)
    return normalized


def load_firebase_project_config() -> FirebaseProjectConfig:
    local_overrides = _load_local_firebase_project_config()
    return FirebaseProjectConfig(
        api_key=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_API_KEY",
            local_overrides.get("api_key", _DEFAULT_FIREBASE_WEB_CONFIG["api_key"]),
        ),
        auth_domain=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_AUTH_DOMAIN",
            local_overrides.get("auth_domain", _DEFAULT_FIREBASE_WEB_CONFIG["auth_domain"]),
        ),
        project_id=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_PROJECT_ID",
            local_overrides.get("project_id", _DEFAULT_FIREBASE_WEB_CONFIG["project_id"]),
        ),
        storage_bucket=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_STORAGE_BUCKET",
            local_overrides.get("storage_bucket", _DEFAULT_FIREBASE_WEB_CONFIG["storage_bucket"]),
        ),
        messaging_sender_id=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_MESSAGING_SENDER_ID",
            local_overrides.get("messaging_sender_id", _DEFAULT_FIREBASE_WEB_CONFIG["messaging_sender_id"]),
        ),
        app_id=os.environ.get(
            "OLLAMA_NETWORK_FIREBASE_APP_ID",
            local_overrides.get("app_id", _DEFAULT_FIREBASE_WEB_CONFIG["app_id"]),
        ),
    )


class GoogleFirebaseTokenVerifier:
    """Validates Firebase ID tokens against Google public keys."""

    def __init__(self, project_id: str) -> None:
        self.project_id = project_id

    def verify(self, token: str) -> dict[str, Any]:
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
        except ImportError as error:
            raise AuthenticationError(
                "Firebase auth support requires the 'google-auth[requests]' package to be installed."
            ) from error

        try:
            payload = id_token.verify_firebase_token(
                token,
                google_requests.Request(),
                audience=self.project_id,
            )
        except Exception as error:  # pragma: no cover - depends on external verifier behavior
            raise AuthenticationError("Your login token could not be verified.") from error

        if not payload:
            raise AuthenticationError("Your login token could not be verified.")

        issuer = str(payload.get("iss", ""))
        expected_issuer = f"https://securetoken.google.com/{self.project_id}"
        if issuer != expected_issuer:
            raise AuthenticationError("Your login token belongs to a different Firebase project.")

        uid = str(payload.get("uid") or payload.get("user_id") or "")
        if not uid:
            raise AuthenticationError("Your login token is missing a Firebase user id.")

        payload["uid"] = uid
        return payload
