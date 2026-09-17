"""WS-4 · Fernando — Estado y plan B. Tareas F1-F6 en plan.md §7.

STUB de WS-0: las rutas existen para que el frontend no truene, pero responden 501.
Reemplázalas junto con service.py y timeline.py. CONSERVA las rutas de §5.3.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, WebSocket

from ..contracts import LabState, initial_lab_state

router = APIRouter()


@router.get("/api/state", response_model=LabState)
async def get_state() -> LabState:
    # WS-4: devolver el estado real del bus (F1).
    return initial_lab_state()


@router.post("/api/demo")
async def demo() -> dict[str, bool]:
    raise HTTPException(status_code=501, detail="WS-4 todavía no implementa Demo (F5)")


@router.post("/api/reset")
async def reset() -> dict[str, bool]:
    raise HTTPException(status_code=501, detail="WS-4 todavía no implementa Reiniciar (F3)")


@router.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    # WS-4: mandar `state` al conectar y reenviar cada cambio del bus (F3).
    await websocket.accept()
    await websocket.send_json({"type": "state", "state": initial_lab_state().model_dump()})
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        return
