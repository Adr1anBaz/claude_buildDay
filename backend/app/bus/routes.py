"""WS-4 · Fernando — Estado y plan B. Rutas del bus (F3) + lógica de Demo (F5).

Reemplaza el stub de WS-0. Conserva las rutas de §5.3 (contrato congelado).
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..contracts import LabState
from .service import Event, bus
from .timeline import register as register_timeline

router = APIRouter()

register_timeline()


def _serialize(event: Event) -> dict[str, Any]:
    if event["type"] == "state":
        return {"type": "state", "state": event["state"].model_dump(mode="json")}
    if event["type"] == "job_started":
        return {"type": "job_started", "job": event["job"].model_dump(mode="json")}
    return event


@router.get("/api/state", response_model=LabState)
async def get_state() -> LabState:
    return bus.get_status()


@router.post("/api/demo")
async def demo() -> dict[str, bool]:
    """F5 — lo que haría Adrián, sin LLM: siempre P1 + estructural + base-dron.stl."""
    bus.say("lab", "Recibido: base-dron.stl.")
    result = bus.submit_job("P1", "estructural", "base-dron.stl")
    if not result.ok:
        raise HTTPException(status_code=409, detail=result.reason)
    bus.say("operador", "Listo. base-dron.stl va a P1, preset estructural.")
    return {"ok": True}


@router.post("/api/reset")
async def reset() -> dict[str, bool]:
    bus.reset()
    return {"ok": True}


@router.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json(_serialize({"type": "state", "state": bus.get_status()}))

    queue: asyncio.Queue[Event] = asyncio.Queue()
    unsubscribe = bus.subscribe(queue.put_nowait)
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(_serialize(event))
    except (WebSocketDisconnect, RuntimeError):
        return
    finally:
        unsubscribe()
