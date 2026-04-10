from __future__ import annotations

from urllib import error

from ollama_network.executor import OllamaCommandExecutor


class FakeStreamResponse:
    def __init__(self, lines: list[str]) -> None:
        self._lines = [line.encode("utf-8") for line in lines]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def __iter__(self):
        return iter(self._lines)


def test_ollama_executor_streams_output_and_collects_token_counts(monkeypatch) -> None:
    def fake_urlopen(req, timeout):
        assert req.full_url.endswith("/api/generate")
        assert timeout == 45
        return FakeStreamResponse(
            [
                '{"response":"Hello","done":false}',
                '{"response":" world","done":false}',
                '{"done":true,"done_reason":"stop","eval_count":12,"prompt_eval_count":9}',
            ]
        )

    monkeypatch.setattr("ollama_network.executor.request.urlopen", fake_urlopen)

    executor = OllamaCommandExecutor(timeout_seconds=45, overall_timeout_seconds=90)
    result = executor.run(
        model_tag="glm4:9b",
        prompt="Say hello.",
        max_output_tokens=64,
    )

    assert result.success is True
    assert result.output_text == "Hello world"
    assert result.output_tokens == 12
    assert result.prompt_tokens_used == 9


def test_ollama_executor_sanitizes_thinking_blocks_from_stream(monkeypatch) -> None:
    def fake_urlopen(req, timeout):
        return FakeStreamResponse(
            [
                '{"response":"<think>drafting</think>Final answer here.","done":false}',
                '{"done":true,"done_reason":"stop","eval_count":7,"prompt_eval_count":5}',
            ]
        )

    monkeypatch.setattr("ollama_network.executor.request.urlopen", fake_urlopen)

    executor = OllamaCommandExecutor(timeout_seconds=30, overall_timeout_seconds=60)
    result = executor.run(
        model_tag="qwen3:4b",
        prompt="Test output cleanup.",
        max_output_tokens=80,
    )

    assert result.success is True
    assert result.output_text == "Final answer here."


def test_ollama_executor_returns_http_errors(monkeypatch) -> None:
    class FakeHTTPError(error.HTTPError):
        def __init__(self) -> None:
            super().__init__(
                url="http://127.0.0.1:11434/api/generate",
                code=500,
                msg="Internal Server Error",
                hdrs=None,
                fp=None,
            )

        def read(self) -> bytes:
            return b'{"error":"model crashed"}'

    def fake_urlopen(req, timeout):
        raise FakeHTTPError()

    monkeypatch.setattr("ollama_network.executor.request.urlopen", fake_urlopen)

    executor = OllamaCommandExecutor(timeout_seconds=30, overall_timeout_seconds=60)
    result = executor.run(
        model_tag="gemma4:26b",
        prompt="Run a hard prompt.",
        max_output_tokens=120,
    )

    assert result.success is False
    assert "Ollama HTTP 500" in result.error_message
