from __future__ import annotations

import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class LocalModelDetection:
    ollama_available: bool
    models: list[str]
    error: str = ""


class LocalOllamaModelDetector:
    """Inspects locally installed Ollama models on the machine running the API server."""

    def __init__(self, ollama_binary: str = "ollama") -> None:
        self.ollama_binary = ollama_binary

    def detect(self) -> LocalModelDetection:
        try:
            completed = subprocess.run(
                [self.ollama_binary, "list"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
        except FileNotFoundError:
            return LocalModelDetection(
                ollama_available=False,
                models=[],
                error="Ollama is not installed or not on PATH.",
            )
        except subprocess.TimeoutExpired:
            return LocalModelDetection(
                ollama_available=False,
                models=[],
                error="Timed out while querying local Ollama models.",
            )

        if completed.returncode != 0:
            return LocalModelDetection(
                ollama_available=False,
                models=[],
                error=completed.stderr.strip() or "ollama list failed",
            )

        return LocalModelDetection(
            ollama_available=True,
            models=self._parse_list_output(completed.stdout),
        )

    @staticmethod
    def _parse_list_output(output: str) -> list[str]:
        models: list[str] = []
        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("NAME"):
                continue
            parts = line.split()
            if parts:
                models.append(parts[0])
        return models
