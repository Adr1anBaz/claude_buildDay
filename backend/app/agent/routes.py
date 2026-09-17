"""WS-5 · Adrián — Operador (agente). Tareas A3-A4 en plan.md §7.

`POST /api/chat` corre el agente de operator.py contra el bus real (de WS-4,
`app/bus/service.py`, escrito en paralelo — se importa de forma perezosa y
defensiva) y `GET /api/agent/health` reporta si hay API key configurada.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..contracts import ChatRequest, ChatResponse
from . import operator, tools

router = APIRouter()

# Candado de "una orden a la vez" (D-15/§5.3): una segunda orden mientras se
# atiende otra responde 429 en vez de esperar.
_lock = asyncio.Lock()

MSG_NO_DISPONIBLE = "Operador no disponible. Usa el botón Demo."
MSG_GUARDIA = "No se pudo confirmar el envío a la impresora. Usa el botón Demo."


def _get_bus() -> Any:
    """Importa el bus real de WS-4 de forma perezosa y defensiva.

    `app/bus/service.py` lo escribe otro agente en paralelo; si todavía no
    existe (o falla al importar) el chat responde "no disponible" en vez de
    tronar con un ImportError.
    """
    try:
        from ..bus.service import bus as real_bus  # type: ignore[import-not-found]
    except Exception:  # noqa: BLE001 - service.py puede no existir todavía
        return None
    return real_bus


@router.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    # Sin API key: el operador está apagado a propósito (plan.md D-06/settings
    # .agent_enabled). No truena, responde ok=false con el mensaje del botón Demo.
    if not settings.agent_enabled:
        return ChatResponse(ok=False, reply=MSG_NO_DISPONIBLE)

    # Candado de una orden a la vez. No hay ningún `await` entre esta lectura
    # y `async with _lock` más abajo, así que no hay condición de carrera.
    if _lock.locked():
        raise HTTPException(status_code=429, detail="Ya se está atendiendo otra orden.")

    async with _lock:
        bus = _get_bus()
        if bus is None:
            return ChatResponse(ok=False, reply=MSG_NO_DISPONIBLE)

        tools.set_bus(bus)

        archivo = body.file or "(sin archivo)"
        bus.say("lab", f"Recibido: {archivo}.")

        try:
            resultado = await asyncio.wait_for(
                operator.run_operator(body.text, body.file),
                timeout=settings.agent_timeout_s,
            )
        except Exception:  # noqa: BLE001 - timeout, error de API, refusal, etc.
            bus.say("operador", MSG_NO_DISPONIBLE)
            return ChatResponse(ok=False, reply=MSG_NO_DISPONIBLE)

        reply = resultado.reply

        # Guardia anti-alucinación (obligatoria): si el modelo dice "Listo" pero
        # en este turno ningún send_to_printer devolvió OK, no le creemos.
        if "listo" in reply.lower() and not resultado.printed_ok:
            reply = MSG_GUARDIA

        bus.say("operador", reply)
        return ChatResponse(ok=True, reply=reply)


@router.get("/api/agent/health")
async def agent_health() -> dict[str, object]:
    return {"anthropic": settings.agent_enabled, "model": settings.anthropic_model}
