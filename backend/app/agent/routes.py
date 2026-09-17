"""WS-5 · Adrián — Operador (agente). Tareas A1-A5 en plan.md §7.

STUB de WS-0: las rutas existen y contestan honestamente que el agente no está listo.
Reemplázalas junto con tools.py y operator.py. CONSERVA las rutas de §5.3.
"""
from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..contracts import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    # WS-5: candado de una orden a la vez, correr el agente y publicar por el bus (A3).
    _ = body
    return ChatResponse(ok=False, reply="Operador no disponible todavía (WS-5, tarea A3). Usa el botón Demo.")


@router.get("/api/agent/health")
async def agent_health() -> dict[str, object]:
    # WS-5: comprobar de verdad contra Ollama (A4).
    return {"ollama": False, "model": settings.ollama_model}
