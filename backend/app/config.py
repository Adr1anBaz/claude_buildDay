"""Configuración por entorno (WS-0). Variables documentadas en plan.md §5.8."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    lab_password: str = os.environ.get("LAB_PASSWORD", "")
    secret_key: str = os.environ.get("SECRET_KEY", "dev-inseguro-cambiar-en-produccion")
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
    agent_timeout_s: float = _float("AGENT_TIMEOUT_S", 60.0)
    # 1.0 = los 24 s reales del demo. Los tests lo bajan para no esperar.
    timeline_scale: float = _float("TIMELINE_SCALE", 1.0)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.lab_password)


settings = Settings()
