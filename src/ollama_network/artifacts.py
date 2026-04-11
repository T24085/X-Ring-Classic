from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path, PurePosixPath


_FENCED_BLOCK_RE = re.compile(r"```(?P<info>[^\n`]*)\n(?P<code>.*?)```", re.DOTALL)
_PROMPT_PATH_RE = re.compile(r"\b([\w./-]+\.(?:html|css|js|jsx|ts|tsx|json|py|md|txt))\b", re.IGNORECASE)
_KNOWN_LANGS = {
    "html": "html",
    "css": "css",
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "jsx": "jsx",
    "tsx": "tsx",
    "json": "json",
    "python": "python",
    "py": "python",
    "markdown": "markdown",
    "md": "markdown",
    "txt": "text",
}
_LANG_DEFAULT_PATHS = {
    "html": "index.html",
    "css": "styles.css",
    "javascript": "index.js",
    "typescript": "index.ts",
    "jsx": "App.jsx",
    "tsx": "App.tsx",
    "json": "data.json",
    "python": "main.py",
    "markdown": "README.md",
    "text": "notes.txt",
}


def extract_job_artifacts(output_text: str, prompt: str = "") -> list[dict[str, str]]:
    text = str(output_text or "").strip()
    if not text:
        return []

    artifacts: list[dict[str, str]] = []
    prompt_paths = _prompt_paths(prompt)
    blocks = list(_FENCED_BLOCK_RE.finditer(text))
    for index, match in enumerate(blocks, start=1):
        info = str(match.group("info") or "").strip()
        code = str(match.group("code") or "").strip("\n")
        if not code.strip():
            continue
        path, language = _path_and_language_from_info(info, prompt_paths, index)
        if not path:
            path = _infer_path(code, language, prompt_paths, index)
        safe_path = _sanitize_relative_path(path)
        if not safe_path:
            continue
        artifacts.append(
            {
                "path": safe_path,
                "language": language or _language_from_path(safe_path),
                "content": code,
            }
        )

    if artifacts:
        return _dedupe_paths(artifacts)

    inferred_path = _infer_inline_document_path(text, prompt_paths)
    if inferred_path:
        return [
            {
                "path": inferred_path,
                "language": _language_from_path(inferred_path),
                "content": text,
            }
        ]
    return []


def materialize_artifacts(root: Path, job_id: str, artifacts: list[dict[str, str]]) -> dict[str, object]:
    if not artifacts:
        raise ValueError("No artifacts are available for this job.")
    export_dir = root / job_id
    export_dir.mkdir(parents=True, exist_ok=True)
    created_files: list[dict[str, str]] = []
    for artifact in artifacts:
        relative_path = _sanitize_relative_path(str(artifact.get("path", "")))
        if not relative_path:
            continue
        target = export_dir / Path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(artifact.get("content", "")), encoding="utf-8")
        created_files.append(
            {
                "path": relative_path,
                "absolute_path": str(target),
            }
        )
    return {
        "job_id": job_id,
        "export_dir": str(export_dir),
        "files": created_files,
    }


def zip_artifacts(job_id: str, artifacts: list[dict[str, str]]) -> tuple[str, bytes]:
    if not artifacts:
        raise ValueError("No artifacts are available for this job.")
    filename = f"{job_id}-artifacts.zip"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for artifact in artifacts:
            relative_path = _sanitize_relative_path(str(artifact.get("path", "")))
            if not relative_path:
                continue
            archive.writestr(relative_path, str(artifact.get("content", "")))
    return filename, buffer.getvalue()


def _prompt_paths(prompt: str) -> list[str]:
    paths: list[str] = []
    for match in _PROMPT_PATH_RE.finditer(str(prompt or "")):
        safe_path = _sanitize_relative_path(match.group(1))
        if safe_path and safe_path not in paths:
            paths.append(safe_path)
    return paths


def _path_and_language_from_info(info: str, prompt_paths: list[str], index: int) -> tuple[str, str]:
    tokens = [token.strip() for token in info.replace(",", " ").split() if token.strip()]
    language = ""
    explicit_path = ""
    for token in tokens:
        candidate = token.split(":", 1)[-1] if ":" in token else token
        safe_path = _sanitize_relative_path(candidate)
        if safe_path and "." in PurePosixPath(safe_path).name:
            explicit_path = safe_path
            continue
        if token.lower() in _KNOWN_LANGS:
            language = _KNOWN_LANGS[token.lower()]
    if explicit_path:
        return explicit_path, language or _language_from_path(explicit_path)
    if prompt_paths and index <= len(prompt_paths):
        prompt_path = prompt_paths[index - 1]
        return prompt_path, language or _language_from_path(prompt_path)
    return "", language


def _infer_path(code: str, language: str, prompt_paths: list[str], index: int) -> str:
    if prompt_paths:
        if len(prompt_paths) == 1:
            return prompt_paths[0]
        if index <= len(prompt_paths):
            return prompt_paths[index - 1]
    normalized_language = language or _guess_language_from_code(code)
    base = _LANG_DEFAULT_PATHS.get(normalized_language, f"snippet-{index}.txt")
    if index == 1:
        return base
    stem = Path(base).stem
    suffix = Path(base).suffix
    return f"{stem}-{index}{suffix}"


def _infer_inline_document_path(text: str, prompt_paths: list[str]) -> str:
    lowered = text.lower()
    if "<html" in lowered and "</html>" in lowered:
        for path in prompt_paths:
            if path.lower().endswith(".html"):
                return path
        return "index.html"
    return ""


def _guess_language_from_code(code: str) -> str:
    lowered = code.lower()
    stripped = code.lstrip()
    if "<html" in lowered or stripped.startswith("<!doctype html"):
        return "html"
    if stripped.startswith("{") or stripped.startswith("["):
        return "json"
    if "function " in code or "const " in code or "document." in code:
        return "javascript"
    if "def " in code or "import " in code:
        return "python"
    return "text"


def _language_from_path(path: str) -> str:
    suffix = Path(path).suffix.lower()
    return {
        ".html": "html",
        ".css": "css",
        ".js": "javascript",
        ".jsx": "jsx",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".json": "json",
        ".py": "python",
        ".md": "markdown",
        ".txt": "text",
    }.get(suffix, "text")


def _sanitize_relative_path(candidate: str) -> str:
    raw = str(candidate or "").replace("\\", "/").strip().strip("`'\"")
    if not raw:
        return ""
    pure = PurePosixPath(raw)
    if pure.is_absolute():
        return ""
    parts = [part for part in pure.parts if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        return ""
    return "/".join(parts)


def _dedupe_paths(artifacts: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: dict[str, int] = {}
    deduped: list[dict[str, str]] = []
    for artifact in artifacts:
        path = str(artifact.get("path", ""))
        if path in seen:
            seen[path] += 1
            base = Path(path)
            artifact = dict(artifact)
            artifact["path"] = f"{base.stem}-{seen[path]}{base.suffix}"
        else:
            seen[path] = 1
        deduped.append(artifact)
    return deduped
