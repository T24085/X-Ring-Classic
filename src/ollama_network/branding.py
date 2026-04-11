from __future__ import annotations

import base64
import os
from functools import lru_cache
from pathlib import Path

DEFAULT_LOGO_PATH = Path(__file__).resolve().parent / "assets" / "logo.png"
LEGACY_LOGO_PATH = Path(r"C:\Users\edchr\Downloads\LLM Network logo design.png")


@lru_cache(maxsize=1)
def load_logo_data_url() -> str:
    configured = os.environ.get("OLLAMA_NETWORK_LOGO_PATH", "").strip()
    candidates = [Path(configured)] if configured else [DEFAULT_LOGO_PATH, LEGACY_LOGO_PATH]
    raw = b""
    path = DEFAULT_LOGO_PATH
    for candidate in candidates:
        try:
            raw = candidate.read_bytes()
            path = candidate
            break
        except OSError:
            continue
    if not raw:
        return ""
    suffix = path.suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg" if suffix in {".jpg", ".jpeg"} else "application/octet-stream"
    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{encoded}"
