"""WS-4 · Fernando — Estado y plan B. Rutas HTTP + WebSocket del bus (§5.3, tareas F3 y F5)."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..contracts import LabState
from .service import bus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/state", response_model=LabState)
async def get_state() -> LabState:
    return bus.get_status()


@router.post("/api/demo")
async def demo() -> dict[str, bool]:
    """El plan B (F5): hace exactamente lo que haría el agente. No interrumpe una orden en curso."""
    bus.say("lab", "Recibido: base-dron.stl.")
    resultado = bus.submit_job("P1", "estructural", "base-dron.stl")
    if not resultado.ok:
        detalle = "P1 está ocupada." if resultado.reason == "printer_busy" else "No hay cajón libre."
        raise HTTPException(status_code=409, detail=detalle)
    bus.say("operador", "Listo. base-dron.stl va a P1, preset estructural.")
    return {"ok": True}


@router.post("/api/reset")
async def reset() -> dict[str, bool]:
    bus.reset()
    return {"ok": True}


@router.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    """Manda `state` al conectar y reenvía cada evento del bus a este cliente (§5.2).

    Los envíos se serializan por una cola propia de la conexión: así dos eventos
    seguidos (p.ej. `chat` y `state`) nunca se mandan en paralelo sobre el mismo
    socket, que rompería el orden o la conexión.
    """
    await websocket.accept()
    cola: asyncio.Queue[dict[str, object]] = asyncio.Queue()
    unsubscribe = bus.subscribe(cola.put_nowait)

    async def _enviar() -> None:
        while True:
            evento = await cola.get()
            try:
                await websocket.send_json(evento)
            except Exception:
                return

    envio = asyncio.create_task(_enviar())
    try:
        await websocket.send_json({"type": "state", "state": bus.get_status().model_dump()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.debug("Conexión /ws cerrada de forma inesperada", exc_info=True)
    finally:
        unsubscribe()
        envio.cancel()
