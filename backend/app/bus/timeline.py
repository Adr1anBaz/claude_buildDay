"""EL SERVIDOR ES DUEÑO DEL TIEMPO (plan.md D-05, §5.5, tarea F2).

Coreografía asíncrona del job ACTIVO. Nunca hay dos jobs activos a la vez: el
que entra mientras otro corre se queda en `queue` (D-10) y arranca solo —
emitiendo SU `job_started`— cuando el activo termina. Todos los tiempos se
multiplican por `settings.timeline_scale` (bajo en los tests, para no esperar
los 24 s reales del demo).
"""
from __future__ import annotations

import asyncio

from ..config import settings
from ..contracts import END_S, GRABBED_S, PRINT_DONE_S, STORED_S, DrawerState, Job
from .service import bus

# Deltas entre pasos consecutivos de §5.5, en segundos "reales" (antes de × TIMELINE_SCALE).
_DELTA_RECOGIENDO = PRINT_DONE_S  # 0 → 10
_DELTA_CON_PIEZA = GRABBED_S - PRINT_DONE_S  # 10 → 14
_DELTA_GUARDADO = STORED_S - GRABBED_S  # 14 → 20
_DELTA_FIN = END_S - STORED_S  # 20 → 24


def _espera(segundos: float) -> float:
    return segundos * settings.timeline_scale


def schedule_job(job: Job) -> None:
    """Arranca la coreografía del job que acaba de volverse el activo."""
    tarea = asyncio.create_task(_correr(job))
    bus.set_active_task(tarea)


async def _correr(job: Job) -> None:
    printer = job.printer
    drawer = job.drawer
    archivo = job.file

    # t=0 — el job pasa a ser el activo.
    activo = job.model_copy(update={"phase": "imprimiendo"})

    def _t0(s):  # noqa: ANN001, ANN202 — closure interna, ver mutate() en service.py
        s.job = activo

    bus.mutate(_t0)
    bus.notify_job_started(activo)
    bus.say("lab", f"Imprimiendo en {printer}…")

    await asyncio.sleep(_espera(_DELTA_RECOGIENDO))
    # t=10 — termina de imprimir, el brazo va por la pieza.
    def _t10(s):  # noqa: ANN001, ANN202
        s.printers[printer] = "Lista"
        s.arm = "En camino"
        if s.job is not None:
            s.job = s.job.model_copy(update={"phase": "recogiendo"})

    bus.mutate(_t10)
    bus.say("lab", f"Recogiendo pieza de {printer}…")

    await asyncio.sleep(_espera(_DELTA_CON_PIEZA))
    # t=14 — el brazo toma la pieza, la impresora vuelve a estar libre.
    def _t14(s):  # noqa: ANN001, ANN202
        s.arm = "Con pieza"
        s.printers[printer] = "Libre"
        if s.job is not None:
            s.job = s.job.model_copy(update={"phase": "guardando"})

    bus.mutate(_t14)

    await asyncio.sleep(_espera(_DELTA_GUARDADO))
    # t=20 — la pieza queda guardada en su cajón.
    def _t20(s):  # noqa: ANN001, ANN202
        s.drawers[drawer] = DrawerState(status="Ocupado", file=archivo)
        s.arm = "En camino"
        if s.job is not None:
            s.job = s.job.model_copy(update={"phase": "cerrando"})

    bus.mutate(_t20)
    bus.say("lab", f"Guardado en cajón {drawer.split('-')[-1]}.")

    await asyncio.sleep(_espera(_DELTA_FIN))
    # t=24 — el brazo vuelve a reposo; si hay cola, arranca sola la siguiente.
    siguiente: Job | None = None

    def _t24(s):  # noqa: ANN001, ANN202
        nonlocal siguiente
        s.arm = "Reposo"
        s.job = None
        if s.queue:
            siguiente = s.queue.pop(0)

    bus.mutate(_t24)

    if siguiente is not None:
        schedule_job(siguiente)
