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
    # El operador usa la API de Anthropic (plan.md D-06). La key se lee del entorno.
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5")
    # Esfuerzo de razonamiento: "low" mantiene la respuesta rápida, que es lo que
    # importa en el demo (el usuario está mirando el "pensando…").
    agent_effort: str = os.environ.get("AGENT_EFFORT", "low")
    agent_timeout_s: float = _float("AGENT_TIMEOUT_S", 60.0)
    # 1.0 = los 24 s reales del demo. Los tests lo bajan para no esperar.
    timeline_scale: float = _float("TIMELINE_SCALE", 1.0)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.lab_password)

    @property
    def agent_enabled(self) -> bool:
        """Sin API key el operador no puede correr; el botón Demo sigue funcionando."""
        return bool(self.anthropic_api_key)


settings = Settings()
