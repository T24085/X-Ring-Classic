from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class LocalGPUDevice:
    name: str
    vram_gb: float
    source: str


@dataclass(frozen=True)
class LocalHardwareDetection:
    detected: bool
    primary_gpu_name: str
    primary_vram_gb: float
    system_ram_gb: float
    gpus: list[LocalGPUDevice]
    error: str = ""


class LocalHardwareDetector:
    """Detects local GPU information for the same-machine worker demo."""

    def detect(self) -> LocalHardwareDetection:
        detectors = [self._detect_with_nvidia_smi, self._detect_with_windows_cim]
        errors: list[str] = []
        system_ram_gb = self._detect_system_ram_gb()
        for detector in detectors:
            try:
                result = detector()
            except Exception as error:  # pragma: no cover - defensive fallback
                errors.append(str(error))
                continue
            if result.detected:
                if result.system_ram_gb <= 0 and system_ram_gb > 0:
                    result = LocalHardwareDetection(
                        detected=result.detected,
                        primary_gpu_name=result.primary_gpu_name,
                        primary_vram_gb=result.primary_vram_gb,
                        system_ram_gb=system_ram_gb,
                        gpus=result.gpus,
                        error=result.error,
                    )
                return result
            if result.error:
                errors.append(result.error)
        return LocalHardwareDetection(
            detected=False,
            primary_gpu_name="",
            primary_vram_gb=0.0,
            system_ram_gb=system_ram_gb,
            gpus=[],
            error="; ".join(error for error in errors if error),
        )

    def _detect_with_nvidia_smi(self) -> LocalHardwareDetection:
        completed = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.strip() or "nvidia-smi failed"
            return LocalHardwareDetection(False, "", 0.0, 0.0, [], error=error)
        gpus: list[LocalGPUDevice] = []
        for line in completed.stdout.splitlines():
            raw = line.strip()
            if not raw:
                continue
            parts = [part.strip() for part in raw.split(",", maxsplit=1)]
            if len(parts) != 2:
                continue
            name, memory_mb = parts
            try:
                vram_gb = round(float(memory_mb) / 1024.0, 1)
            except ValueError:
                continue
            gpus.append(LocalGPUDevice(name=name, vram_gb=vram_gb, source="nvidia-smi"))
        return self._finalize(gpus, "nvidia-smi did not report any GPUs.")

    def _detect_with_windows_cim(self) -> LocalHardwareDetection:
        if not sys.platform.startswith("win"):
            return LocalHardwareDetection(False, "", 0.0, 0.0, [], error="Windows CIM detection unavailable.")
        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | "
                "Select-Object Name, AdapterRAM, Status | ConvertTo-Json -Depth 3",
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.strip() or "Win32_VideoController query failed"
            return LocalHardwareDetection(False, "", 0.0, 0.0, [], error=error)
        payload = completed.stdout.strip()
        if not payload:
            return LocalHardwareDetection(False, "", 0.0, 0.0, [], error="No GPU data returned from Win32_VideoController.")
        parsed = json.loads(payload)
        entries = parsed if isinstance(parsed, list) else [parsed]
        gpus: list[LocalGPUDevice] = []
        for item in entries:
            if not isinstance(item, dict):
                continue
            name = str(item.get("Name", "")).strip()
            if not name:
                continue
            try:
                vram_gb = round(float(item.get("AdapterRAM", 0)) / (1024.0 ** 3), 1)
            except (TypeError, ValueError):
                vram_gb = 0.0
            gpus.append(LocalGPUDevice(name=name, vram_gb=max(vram_gb, 0.0), source="win32_video_controller"))
        return self._finalize(gpus, "Windows reported no usable GPU devices.")

    def _detect_system_ram_gb(self) -> float:
        if not sys.platform.startswith("win"):
            return 0.0
        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ],
            capture_output=True,
            text=True,
            timeout=6,
            check=False,
        )
        if completed.returncode != 0:
            return 0.0
        raw = completed.stdout.strip()
        try:
            total_bytes = float(raw)
        except ValueError:
            return 0.0
        return round(total_bytes / (1024.0 ** 3), 1)

    @staticmethod
    def _finalize(gpus: list[LocalGPUDevice], error: str) -> LocalHardwareDetection:
        if not gpus:
            return LocalHardwareDetection(False, "", 0.0, 0.0, [], error=error)
        primary = max(gpus, key=lambda gpu: gpu.vram_gb)
        return LocalHardwareDetection(
            detected=True,
            primary_gpu_name=primary.name,
            primary_vram_gb=primary.vram_gb,
            system_ram_gb=0.0,
            gpus=gpus,
            error="",
        )
