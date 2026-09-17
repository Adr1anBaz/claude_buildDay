"""Bus del laboratorio (WS-4, tarea F1). Única fuente de verdad del estado (plan.md §5.4).

Nadie más escribe el estado del lab: el agente, el botón Demo y los tests pasan
siempre por esta instancia (`bus`). `timeline.py` es la única otra pieza que toca
el estado, y lo hace a través de `mutate()` / `notify_job_started()` /
`set_active_task()` — una extensión interna del paquete, no parte de la API
"oficial" de §5.4 (`get_status`, `submit_job`, `say`, `reset`, `subscribe`).
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Callable

from ..contracts import (
    DRAWER_IDS,
    ChatFrom,
    DrawerId,
    DrawerState,
    Job,
    LabState,
    Preset,
    PrinterId,
    SubmitResult,
    initial_lab_state,
)

logger = logging.getLogger(__name__)

Event = dict[str, object]
Subscriber = Callable[[Event], None]
Unsubscribe = Callable[[], None]


def _now_ms() -> int:
    return int(time.time() * 1000)


class LabBus:
    """Estado en memoria del lab (D-04) + notificaciones a suscriptores (el hub de /ws)."""

    def __init__(self) -> None:
        self._state: LabState = initial_lab_state()
        self._subscribers: set[Subscriber] = set()
        self._active_task: asyncio.Task[None] | None = None

    # ── §5.4 API pública ────────────────────────────────────────────────────
    def get_status(self) -> LabState:
        """Copia del estado actual; el llamador nunca debe mutar el estado interno."""
        return self._state.model_copy(deep=True)

    def submit_job(self, printer: PrinterId, preset: Preset, file: str) -> SubmitResult:
        """Valida, reserva impresora + cajón, y arranca o encola el job (D-10, D-11)."""
        if self._state.printers[printer] != "Libre":
            return SubmitResult(ok=False, reason="printer_busy")

        drawer = self._primer_cajon_libre()
        if drawer is None:
            self._state.noDrawer = True
            self._bump_and_notify()
            return SubmitResult(ok=False, reason="no_drawer")

        job = Job(
            id=f"job-{uuid.uuid4().hex[:8]}",
            file=file,
            preset=preset,
            printer=printer,
            drawer=drawer,
            phase="en_cola",
        )
        self._state.printers[printer] = "Imprimiendo"
        self._state.drawers[drawer] = DrawerState(status="Reservado", file=file)
        self._state.noDrawer = False

        se_activa_ya = self._state.job is None
        if se_activa_ya:
            self._state.job = job
        else:
            self._state.queue.append(job)

        self._bump_and_notify()

        if se_activa_ya:
            # Import diferido: timeline.py importa `bus` de este módulo, así se evita el ciclo.
            from .timeline import schedule_job

            schedule_job(job)
        else:
            self.say("lab", f"En cola: {file} espera al brazo.")

        return SubmitResult(ok=True, job=job)

    def say(self, from_: ChatFrom, text: str) -> None:
        self._notify({"type": "chat", "from": from_, "text": text, "ts": _now_ms()})

    def reset(self) -> None:
        """Vuelve al estado inicial y cancela cualquier coreografía pendiente."""
        if self._active_task is not None and not self._active_task.done():
            self._active_task.cancel()
        self._active_task = None
        self._state = initial_lab_state()
        self._notify({"type": "reset"})
        self._notify({"type": "state", "state": self._state.model_dump()})

    def subscribe(self, callback: Subscriber) -> Unsubscribe:
        self._subscribers.add(callback)

        def unsubscribe() -> None:
            self._subscribers.discard(callback)

        return unsubscribe

    # ── Extensión interna (uso exclusivo de timeline.py) ───────────────────
    def mutate(self, fn: Callable[[LabState], None]) -> None:
        """Aplica una mutación al estado y notifica. Solo lo usa la coreografía de timeline.py."""
        fn(self._state)
        self._bump_and_notify()

    def notify_job_started(self, job: Job) -> None:
        self._notify({"type": "job_started", "job": job.model_dump()})

    def set_active_task(self, task: asyncio.Task[None]) -> None:
        self._active_task = task

    # ── privado ─────────────────────────────────────────────────────────────
    def _primer_cajon_libre(self) -> DrawerId | None:
        for d in DRAWER_IDS:
            if self._state.drawers[d].status == "Libre":
                return d
        return None

    def _bump_and_notify(self) -> None:
        self._state.version += 1
        self._notify({"type": "state", "state": self._state.model_dump()})

    def _notify(self, event: Event) -> None:
        for cb in list(self._subscribers):
            try:
                cb(event)
            except Exception:  # un suscriptor roto (p.ej. un socket caído) no tumba el bus
                logger.exception("Suscriptor del bus falló al recibir %s", event.get("type"))


bus = LabBus()
