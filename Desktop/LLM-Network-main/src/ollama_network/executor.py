from __future__ import annotations

import json
import os
import re
import time
from typing import Optional
from urllib import error, request

from .models import ExecutorResult


class OllamaCommandExecutor:
    """Executes local-only inference through the Ollama local HTTP API."""

    _ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
    _THINKING_MARKERS = ("...done thinking.", "</think>")

    def __init__(
        self,
        ollama_host: str = "http://127.0.0.1:11434",
        timeout_seconds: Optional[float] = None,
        overall_timeout_seconds: Optional[float] = None,
    ) -> None:
        self.ollama_host = ollama_host.rstrip("/")
        configured_idle = float(os.environ.get("OLLAMA_NETWORK_OLLAMA_IDLE_TIMEOUT_SECONDS", "900"))
        configured_overall = float(os.environ.get("OLLAMA_NETWORK_OLLAMA_OVERALL_TIMEOUT_SECONDS", "3600"))
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else configured_idle
        self.overall_timeout_seconds = (
            overall_timeout_seconds
            if overall_timeout_seconds is not None
            else configured_overall
        )

    def run(self, model_tag: str, prompt: str, max_output_tokens: int) -> ExecutorResult:
        start = time.perf_counter()
        constrained_prompt = f"{prompt}\n\nRespond in no more than {max_output_tokens} tokens."
        payload = {
            "model": model_tag,
            "prompt": constrained_prompt,
            "stream": True,
            "options": {
                "num_predict": max(max_output_tokens, 1),
            },
        }
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url=f"{self.ollama_host}/api/generate",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                parsed = self._read_streamed_generate_response(response, start=start)
        except error.HTTPError as http_error:
            detail = http_error.read().decode("utf-8", errors="replace")
            return ExecutorResult(
                success=False,
                output_text="",
                output_tokens=0,
                latency_seconds=time.perf_counter() - start,
                verified=False,
                error_message=f"Ollama HTTP {http_error.code}: {detail.strip() or 'request failed'}",
            )
        except Exception as error_message:
            return ExecutorResult(
                success=False,
                output_text="",
                output_tokens=0,
                latency_seconds=time.perf_counter() - start,
                verified=False,
                error_message=f"Ollama request failed: {error_message}",
            )

        output_text = self._sanitize_output(str(parsed.get("response", "")))
        if not output_text:
            output_text = self._sanitize_output(str(parsed.get("thinking", "")))
        success = bool(parsed.get("done", True))
        if parsed.get("done_reason") == "stop":
            success = True
        error_message = "" if success else str(parsed.get("error", "") or "ollama generate failed")
        output_tokens = int(parsed.get("eval_count", 0) or 0)
        if output_tokens <= 0:
            output_tokens = self._estimate_tokens(output_text)
        prompt_tokens_used = int(parsed.get("prompt_eval_count", 0) or 0)
        return ExecutorResult(
            success=success,
            output_text=output_text,
            output_tokens=output_tokens,
            latency_seconds=time.perf_counter() - start,
            prompt_tokens_used=prompt_tokens_used,
            verified=success,
            error_message=error_message,
        )

    def _read_streamed_generate_response(self, response, start: float) -> dict[str, object]:
        chunks: list[str] = []
        final_payload: dict[str, object] = {}
        for raw_line in response:
            if self.overall_timeout_seconds and (time.perf_counter() - start) > self.overall_timeout_seconds:
                raise TimeoutError(
                    f"Ollama generation exceeded the overall timeout of {self.overall_timeout_seconds:.0f} seconds."
                )
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError as decode_error:
                raise ValueError(f"Ollama returned invalid streamed JSON: {decode_error}") from decode_error
            if payload.get("response"):
                chunks.append(str(payload.get("response", "")))
            final_payload.update(payload)
        if not final_payload and not chunks:
            raise ValueError("Ollama returned an empty streamed response.")
        final_payload["response"] = "".join(chunks)
        return final_payload

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        return max(1, int(len([token for token in text.split() if token.strip()]) * 1.3)) if text else 0

    @classmethod
    def _sanitize_output(cls, text: str) -> str:
        cleaned = cls._ANSI_ESCAPE_RE.sub("", text or "")
        cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n").strip()
        cleaned = cls._strip_thinking_block(cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    @classmethod
    def _strip_thinking_block(cls, text: str) -> str:
        if not text:
            return ""
        think_match = re.search(r"<think>.*?</think>\s*", text, flags=re.DOTALL | re.IGNORECASE)
        if think_match:
            stripped = (text[: think_match.start()] + text[think_match.end() :]).strip()
            return stripped or text
        lowered = text.lower()
        for marker in cls._THINKING_MARKERS:
            marker_index = lowered.rfind(marker)
            if marker_index >= 0:
                stripped = text[marker_index + len(marker) :].strip()
                return stripped or text
        return text
