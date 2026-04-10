from __future__ import annotations

from ollama_network.ollama_local import LocalOllamaModelDetector


def test_parse_ollama_list_output() -> None:
    output = """NAME                      ID              SIZE      MODIFIED
llama3.1:8b               abc123          4.9 GB    2 hours ago
qwen3:4b                  def456          2.5 GB    3 days ago
"""
    parsed = LocalOllamaModelDetector._parse_list_output(output)
    assert parsed == ["llama3.1:8b", "qwen3:4b"]
