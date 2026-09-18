"""WS-4 · Fernando — Línea de tiempo del job activo (F2, plan.md §5.5).

El bus (service.py) solo decide transiciones puras; este módulo pone los tiempos.
Se suscribe a `job_started` y corre una tarea asyncio por job activo. Al terminar
(t=24s), `bus.complete_active_job()` activa el siguiente de la cola (D-10), lo que
vuelve a emitir `job_started` y este mismo subscriber le arranca su propia timeline.
"""
from __future__ import annotations

import asyncio

from ..config import settings
from ..contracts import END_S, GRABBED_S, PRINT_DONE_S, STORED_S, Job
from .service import Event, bus


def _scaled(seconds: float) -> float:
    return seconds * settings.timeline_scale


async def _run(job: Job) -> None:
    # t=0: el job ya está activo (service.py lo marcó y emitió job_started).
    bus.set_job_phase("imprimiendo")
    bus.say("lab", f"Imprimiendo en {job.printer}…")

    await asyncio.sleep(_scaled(PRINT_DONE_S))
    bus.set_printer(job.printer, "Lista")
    bus.set_arm("En camino")
    bus.set_job_phase("recogiendo")
    bus.say("lab", f"Recogiendo pieza de {job.printer}…")

    await asyncio.sleep(_scaled(GRABBED_S - PRINT_DONE_S))
    bus.set_arm("Con pieza")
    bus.set_printer(job.printer, "Libre")
    bus.set_job_phase("guardando")

    await asyncio.sleep(_scaled(STORED_S - GRABBED_S))
    bus.store_piece(job.drawer, job.file)
    bus.set_arm("En camino")
    bus.set_job_phase("cerrando")
    bus.say("lab", f"Guardado en cajón {job.drawer[-1]}.")

    await asyncio.sleep(_scaled(END_S - STORED_S))
    bus.set_arm("Reposo")
    bus.complete_active_job()


def _on_event(event: Event) -> None:
    if event["type"] == "job_started":
        # TODO(DT-4-01): no se trackea/cancela esta tarea si bus.reset() llega a medio job.
        asyncio.create_task(_run(event["job"]))


_registered = False


def register() -> None:
    """Suscribe la timeline al bus. Llamarla una sola vez (routes.py lo hace al importar)."""
    global _registered
    if _registered:
        return
    _registered = True
    bus.subscribe(_on_event)
