"""WS-5 · Adrián — Rutas del operador (A3 y A4, plan.md §5.3).

Reemplaza el stub de WS-0 (DT-0-08). Las rutas de §5.3 son contrato congelado.

Todo lo que el usuario ve del lab sale del bus (D-14): esta ruta publica `Recibido:` y la
respuesta del operador con `bus.say(...)`, y el cuerpo del POST solo sirve para que el
dashboard sepa si desbloquear el input. Una orden a la vez (D-15): la segunda recibe 429.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from ..bus.service import bus
from ..config import settings
from ..contracts import ChatRequest, ChatResponse
from . import operator

log = logging.getLogger(__name__)

router = APIRouter()

_lock = asyncio.Lock()
"""Candado de 'una orden a la vez'. Vive en memoria y en un solo worker, igual que el bus.

TODO(DT-5-05): con más de un worker deja de proteger; se paga junto con DT-0-01.
"""

_llm_ok = False
"""Última verificación conocida del modelo. La fija el warm-up y cada orden que corre bien."""

SIN_OPERADOR = "Operador no disponible. Usa Demo."


@router.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    global _llm_ok

    if _lock.locked():
        # 429: el operador atiende una orden a la vez (D-15). El lab sigue funcionando.
        raise HTTPException(status_code=429, detail="El operador está atendiendo otra orden.")

    async with _lock:
        recibido = f"Recibido: {body.file}." if body.file else "Recibido: orden sin archivo."
        bus.say("lab", recibido)

        try:
            result = await operator.run_order(
                body.text,
                body.file,
                bus,
                timeout_s=settings.agent_timeout_s,
                # La confirmación se publica en cuanto el bus acepta, no cuando el modelo
                # termina de hablar: así el chat respeta el orden de §5.5 y se ve igual
                # que con el botón Demo (D-14), sin los segundos de más del LLM.
                on_launch=lambda job: bus.say("operador", operator.confirmacion(job)),
            )
        except asyncio.TimeoutError:
            log.warning("El operador excedió AGENT_TIMEOUT_S=%s", settings.agent_timeout_s)
            _llm_ok = False
            bus.say("lab", SIN_OPERADOR)
            return ChatResponse(ok=False, reply=SIN_OPERADOR)
        except Exception as exc:  # falta de API key, red caída, error del proveedor
            log.exception("El operador falló: %s", exc)
            _llm_ok = False
            bus.say("lab", SIN_OPERADOR)
            return ChatResponse(ok=False, reply=SIN_OPERADOR)

        _llm_ok = True
        if not result.launched:
            # Si se lanzó, la línea ya salió por `on_launch`; publicarla otra vez la duplicaría.
            bus.say("operador", result.reply)
        return ChatResponse(ok=True, reply=result.reply)


@router.get("/api/agent/health")
async def agent_health() -> dict[str, object]:
    # `ollama` es la llave congelada de §5.3; hoy significa "el LLM responde".
    # TODO(DT-5-01): renombrarla a `llm` cuando WS-0 descongele el contrato.
    return {"ollama": _llm_ok, "model": operator.model_id(), "provider": "anthropic"}


# ── Warm-up (A4) ──────────────────────────────────────────────────────────────
async def _warmup() -> None:
    """Confirma al arrancar que la API key y el modelo responden, sin bloquear el arranque.

    Con Anthropic no hay modelo que cargar, así que esto es una verificación de
    credencial/red: la primera orden del demo no debe ser la que descubra que algo falta.
    """
    global _llm_ok
    if not operator.api_key():
        log.warning("Sin ANTHROPIC_API_KEY: el operador queda apagado, el demo usa el botón Demo.")
        _llm_ok = False
        return
    try:
        await asyncio.wait_for(operator.ping(), timeout=20)
        _llm_ok = True
        log.info("Operador listo con %s", operator.model_id())
    except Exception as exc:
        _llm_ok = False
        log.warning("Warm-up del operador falló (%s). El plan B es el botón Demo.", exc)


@router.on_event("startup")  # TODO(DT-5-02): API vieja de FastAPI; main.py es de WS-0.
async def _on_startup() -> None:
    # En segundo plano: si Anthropic tarda, el servidor arranca igual.
    asyncio.create_task(_warmup())
