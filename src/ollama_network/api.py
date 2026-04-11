from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional
from urllib.parse import urlparse

from .auth import AuthenticationError, GoogleFirebaseTokenVerifier, load_firebase_project_config
from .dashboard import render_dashboard_html
from .landing import render_landing_html
from .models import AuthorizationError, PolicyError
from .service import NetworkService, handle_policy_error


class NetworkHTTPServer(ThreadingHTTPServer):
    service: NetworkService

    def __init__(
        self,
        server_address: tuple[str, int],
        service: NetworkService,
        auth_verifier: Optional[object] = None,
        firebase_client_config: Optional[dict[str, str]] = None,
    ) -> None:
        super().__init__(server_address, NetworkAPIHandler)
        self.service = service
        self.auth_verifier = auth_verifier
        self.firebase_client_config = firebase_client_config or {}


class NetworkAPIHandler(BaseHTTPRequestHandler):
    server: NetworkHTTPServer

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            if path == "/":
                self._write_html(
                    HTTPStatus.OK,
                    render_landing_html(self.server.firebase_client_config),
                )
                return
            if path == "/dashboard":
                self._write_html(
                    HTTPStatus.OK,
                    render_dashboard_html(self.server.firebase_client_config),
                )
                return
            if path == "/health":
                self._write_json(HTTPStatus.OK, {"status": "ok"})
                return
            auth_claims = self._require_auth()
            if path == "/auth/session":
                if not auth_claims:
                    self._write_json(HTTPStatus.OK, {"auth_enabled": False})
                    return
                self._write_json(HTTPStatus.OK, self.server.service.get_authenticated_session(auth_claims))
                return
            actor_session = self._actor_session(auth_claims)
            actor_user_id = str(actor_session.get("user_id", "")) or None if actor_session else None
            actor_email = str(actor_session.get("email", "")) if actor_session else ""
            if path == "/models":
                self._write_json(HTTPStatus.OK, self.server.service.list_models())
                return
            if path == "/identity-context":
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_identity_context(actor_user_id=actor_user_id),
                )
                return
            if path == "/wallet":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(HTTPStatus.OK, self.server.service.get_wallet(actor_user_id))
                return
            if path == "/conversations":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(HTTPStatus.OK, self.server.service.list_conversations(actor_user_id))
                return
            if path == "/ledger":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(HTTPStatus.OK, self.server.service.get_ledger(actor_user_id))
                return
            if path == "/jobs":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.list_jobs(
                        actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path == "/admin/overview":
                if not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(HTTPStatus.OK, self.server.service.get_admin_overview(actor_email))
                return
            if path == "/worker-context":
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_worker_context(actor_user_id=actor_user_id),
                )
                return
            if path == "/workers/tokens":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.list_worker_tokens(actor_user_id),
                )
                return
            if path == "/network":
                self._write_json(HTTPStatus.OK, self.server.service.get_network())
                return
            if path.startswith("/users/"):
                user_id = path.split("/", maxsplit=2)[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_user(
                        user_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/workers/") and path.endswith("/stats"):
                parts = path.strip("/").split("/")
                if len(parts) != 3:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                worker_id = parts[1]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_worker_stats(
                        worker_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/jobs/") and path.endswith("/artifacts/download"):
                if not actor_user_id and not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[1]
                filename, content = self.server.service.download_job_artifacts(
                    job_id,
                    actor_user_id=actor_user_id,
                    actor_email=actor_email,
                )
                self._write_bytes(
                    HTTPStatus.OK,
                    content,
                    content_type="application/zip",
                    filename=filename,
                )
                return
            if path.startswith("/jobs/"):
                job_id = path.split("/", maxsplit=2)[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_job(
                        job_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/conversations/"):
                conversation_id = path.split("/", maxsplit=2)[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_conversation(
                        conversation_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        except KeyError:
            self._write_json(HTTPStatus.NOT_FOUND, {"error": "unknown resource"})
        except AuthenticationError as error:
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": str(error)})
        except AuthorizationError as error:
            self._write_json(HTTPStatus.FORBIDDEN, {"error": str(error)})
        except PolicyError as error:
            status, payload = handle_policy_error(error)
            self._write_json(status, payload)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            worker_session = self._worker_token_session()
            actor_user_id: Optional[str] = None
            actor_email = ""
            if worker_session:
                if not self._path_allows_worker_token(path):
                    raise AuthorizationError("Worker tokens can only be used for worker daemon routes.")
                actor_user_id = str(worker_session.get("user_id", "")) or None
            else:
                auth_claims = self._require_auth()
                actor_session = self._actor_session(auth_claims)
                actor_user_id = str(actor_session.get("user_id", "")) or None if actor_session else None
                actor_email = str(actor_session.get("email", "")) if actor_session else ""
            payload = self._read_json_body()
            if path == "/users/issue":
                result = self.server.service.issue_user_identity(
                    starting_credits=float(payload.get("starting_credits", 0.0)),
                    actor_user_id=actor_user_id,
                )
                self._write_json(HTTPStatus.CREATED, result)
                return
            if path == "/users/register":
                result = self.server.service.register_user(
                    user_id=str(payload["user_id"]),
                    starting_credits=float(payload.get("starting_credits", 0.0)),
                    actor_user_id=actor_user_id,
                )
                self._write_json(HTTPStatus.CREATED, result)
                return
            if path.startswith("/admin/users/") and path.endswith("/credits"):
                if not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                user_id = parts[2]
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.admin_adjust_credits(
                        target_user_id=user_id,
                        amount=int(payload.get("amount", 0)),
                        actor_email=actor_email,
                        note=str(payload.get("note", "")),
                    ),
                )
                return
            if path.startswith("/admin/jobs/") and path.endswith("/cancel"):
                if not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.admin_cancel_job(
                        job_id=job_id,
                        actor_email=actor_email,
                        note=str(payload.get("note", "")),
                    ),
                )
                return
            if path.startswith("/admin/jobs/") and path.endswith("/reroute"):
                if not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.admin_reroute_job(
                        job_id=job_id,
                        model_tag=str(payload.get("model_tag", "auto")),
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/admin/jobs/") and path.endswith("/restart"):
                if not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.admin_restart_failed_job(
                        job_id=job_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/jobs/") and path.endswith("/restart"):
                if not actor_user_id and not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 3:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[1]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.restart_failed_job(
                        job_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/jobs/") and path.endswith("/artifacts/create"):
                if not actor_user_id and not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                job_id = parts[1]
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.create_job_artifacts(
                        job_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/conversations/") and path.endswith("/archive"):
                if not actor_user_id and not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 3:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                conversation_id = parts[1]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.archive_conversation(
                        conversation_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path.startswith("/conversations/") and path.endswith("/restore"):
                if not actor_user_id and not actor_email:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 3:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                conversation_id = parts[1]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.restore_conversation(
                        conversation_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            if path == "/credits/purchase":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.purchase_credits(
                        usd_amount=float(payload.get("usd_amount", 0.0)),
                        actor_user_id=actor_user_id,
                    ),
                )
                return
            if path == "/workers/tokens":
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.issue_worker_token(
                        actor_user_id=actor_user_id,
                        label=str(payload.get("label", "")),
                    ),
                )
                return
            if path.startswith("/workers/tokens/") and path.endswith("/revoke"):
                if not actor_user_id:
                    raise AuthenticationError("Sign in with Google to use the network.")
                parts = path.strip("/").split("/")
                if len(parts) != 4:
                    self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
                    return
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.revoke_worker_token(
                        actor_user_id=actor_user_id,
                        token_id=parts[2],
                    ),
                )
                return
            if path == "/workers/register":
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.register_worker(payload, actor_user_id=actor_user_id),
                )
                return
            if path == "/workers/start-local":
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.start_local_worker(
                        {
                            **payload,
                            "actor_email": actor_email,
                        },
                        actor_user_id=actor_user_id,
                    ),
                )
                return
            if path.startswith("/workers/") and path.endswith("/claim"):
                worker_id = path.split("/")[2]
                assignment = self.server.service.claim_job_for_worker(
                    worker_id,
                    actor_user_id=actor_user_id,
                    actor_email=actor_email,
                    allow_admin_self_serve=bool(payload.get("allow_admin_self_serve", False)),
                )
                if assignment is None:
                    self._write_json(HTTPStatus.OK, {"assignment": None})
                    return
                self._write_json(HTTPStatus.OK, {"assignment": assignment})
                return
            if path.startswith("/workers/") and path.endswith("/queue-status"):
                worker_id = path.split("/")[2]
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.inspect_worker_queue(
                        worker_id,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                        allow_admin_self_serve=bool(payload.get("allow_admin_self_serve", False)),
                    ),
                )
                return
            if path.startswith("/workers/") and path.endswith("/stop-local"):
                worker_id = path.split("/")[2]
                self._write_json(
                    HTTPStatus.OK,
                    {"loop": self.server.service.stop_local_worker(worker_id, actor_user_id=actor_user_id)},
                )
                return
            if path.startswith("/workers/") and path.endswith("/run-once"):
                worker_id = path.split("/")[2]
                result = self.server.service.run_worker_cycle(
                    worker_id,
                    actor_user_id=actor_user_id,
                    actor_email=actor_email,
                    allow_admin_self_serve=bool(payload.get("allow_admin_self_serve", False)),
                )
                if result is None:
                    self._write_json(
                        HTTPStatus.OK,
                        {
                            "job": None,
                            "queue": self.server.service.inspect_worker_queue(
                                worker_id,
                                actor_user_id=actor_user_id,
                                actor_email=actor_email,
                                allow_admin_self_serve=bool(payload.get("allow_admin_self_serve", False)),
                            ),
                        },
                    )
                    return
                self._write_json(HTTPStatus.OK, {"job": result})
                return
            if path == "/jobs":
                self._write_json(
                    HTTPStatus.CREATED,
                    self.server.service.submit_job(payload, actor_user_id=actor_user_id),
                )
                return
            if path == "/jobs/complete":
                self._write_json(
                    HTTPStatus.OK,
                    self.server.service.complete_job(
                        payload,
                        actor_user_id=actor_user_id,
                        actor_email=actor_email,
                    ),
                )
                return
            self._write_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        except json.JSONDecodeError:
            self._write_json(HTTPStatus.BAD_REQUEST, {"error": "invalid json"})
        except KeyError as error:
            self._write_json(HTTPStatus.BAD_REQUEST, {"error": f"missing field: {error.args[0]}"})
        except AuthenticationError as error:
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": str(error)})
        except AuthorizationError as error:
            self._write_json(HTTPStatus.FORBIDDEN, {"error": str(error)})
        except PolicyError as error:
            status, body = handle_policy_error(error)
            self._write_json(status, body)
        except ValueError as error:
            self._write_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json_body(self) -> dict[str, object]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("JSON body must be an object.")
        return parsed

    def _require_auth(self) -> dict[str, Any]:
        verifier = getattr(self.server, "auth_verifier", None)
        if verifier is None:
            return {}
        header = self.headers.get("Authorization", "").strip()
        if not header.startswith("Bearer "):
            raise AuthenticationError("Sign in with Google to use the network.")
        token = header.split(" ", maxsplit=1)[1].strip()
        if not token:
            raise AuthenticationError("Sign in with Google to use the network.")
        return verifier.verify(token)

    def _actor_session(self, auth_claims: dict[str, Any]) -> Optional[dict[str, object]]:
        if not auth_claims:
            return None
        return self.server.service.get_authenticated_session(auth_claims)

    def _worker_token_session(self) -> Optional[dict[str, object]]:
        token = self.headers.get("X-Worker-Token", "").strip()
        if not token:
            return None
        return self.server.service.authenticate_worker_token(token)

    @staticmethod
    def _path_allows_worker_token(path: str) -> bool:
        if path == "/workers/register" or path == "/jobs/complete":
            return True
        if path.startswith("/workers/") and (
            path.endswith("/claim")
            or path.endswith("/queue-status")
            or path.endswith("/run-once")
        ):
            return True
        return False

    def _write_json(self, status: int | HTTPStatus, payload: dict[str, object]) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _write_html(self, status: int | HTTPStatus, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _write_bytes(
        self,
        status: int | HTTPStatus,
        payload: bytes,
        content_type: str,
        filename: str = "",
    ) -> None:
        self.send_response(int(status))
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(payload)


def create_server(
    host: str = "localhost",
    port: int = 8000,
    require_auth: bool = True,
) -> NetworkHTTPServer:
    service = NetworkService()
    firebase_config = load_firebase_project_config()
    auth_verifier = (
        GoogleFirebaseTokenVerifier(firebase_config.project_id)
        if require_auth
        else None
    )
    return NetworkHTTPServer(
        (host, port),
        service=service,
        auth_verifier=auth_verifier,
        firebase_client_config=firebase_config.to_web_dict(),
    )
