"""WS-4 · Fernando — Bus del lab (F1). Único dueño del estado (plan.md §5.4).

Instancia única: `from app.bus.service import bus`. Sin tiempos aquí (los pone timeline.py, F2):
este módulo solo decide transiciones de estado puras y síncronas.
"""
from __future__ import annotations

import itertools
import time
from typing import Callable

from ..contracts import (
    DRAWER_IDS,
    ArmStatus,
    ChatFrom,
    DrawerId,
    DrawerState,
    Job,
    JobPhase,
    Preset,
    PrinterId,
    PrinterStatus,
    SubmitResult,
    initial_lab_state,
)

Event = dict
Callback = Callable[[Event], None]
Unsubscribe = Callable[[], None]


class Bus:
    def __init__(self) -> None:
        self._state = initial_lab_state()
        self._subscribers: list[Callback] = []
        self._job_ids = itertools.count(1)

    # ── Lectura ────────────────────────────────────────────────────────────
    def get_status(self):
        return self._state

    # ── Suscripción (la usa el hub de /ws en routes.py, y timeline.py) ──────
    def subscribe(self, callback: Callback) -> Unsubscribe:
        self._subscribers.append(callback)

        def unsubscribe() -> None:
            if callback in self._subscribers:
                self._subscribers.remove(callback)

        return unsubscribe

    def _emit(self, event: Event) -> None:
        for callback in list(self._subscribers):
            callback(event)

    def _emit_state(self) -> None:
        self._state.version += 1
        self._emit({"type": "state", "state": self._state})

    # ── Chat (D-14: todo lo que aparece en pantalla sale de aquí) ───────────
    def say(self, from_: ChatFrom, text: str) -> None:
        self._emit({"type": "chat", "from": from_, "text": text, "ts": time.time()})

    # ── Órdenes ──────────────────────────────────────────────────────────────
    def submit_job(self, printer: PrinterId, preset: Preset, file: str) -> SubmitResult:
        if self._state.printers[printer] != "Libre":
            return SubmitResult(ok=False, reason="printer_busy")

        drawer = self._first_free_drawer()
        if drawer is None:
            self._state.noDrawer = True
            self._emit_state()
            return SubmitResult(ok=False, reason="no_drawer")

        job = Job(
            id=f"job-{next(self._job_ids)}",
            file=file,
            preset=preset,
            printer=printer,
            drawer=drawer,
            phase="en_cola",
        )
        self._state.noDrawer = False
        self._state.printers[printer] = "Imprimiendo"
        self._state.drawers[drawer] = DrawerState(status="Reservado", file=None)

        if self._state.job is None:
            self._activate(job)
        else:
            self._state.queue.append(job)
            self.say("lab", f"En cola: {file} espera al brazo.")
            self._emit_state()

        return SubmitResult(ok=True, job=job)

    def _first_free_drawer(self) -> DrawerId | None:
        for drawer_id in DRAWER_IDS:
            if self._state.drawers[drawer_id].status == "Libre":
                return drawer_id
        return None

    def _activate(self, job: Job) -> None:
        self._state.job = job
        self._emit_state()
        self._emit({"type": "job_started", "job": job})

    # ── Mutaciones que usa timeline.py (F2) durante la línea de tiempo ──────
    def set_printer(self, printer: PrinterId, status: PrinterStatus) -> None:
        self._state.printers[printer] = status
        self._emit_state()

    def set_arm(self, status: ArmStatus) -> None:
        self._state.arm = status
        self._emit_state()

    def set_job_phase(self, phase: JobPhase) -> None:
        if self._state.job is not None:
            self._state.job.phase = phase
        self._emit_state()

    def store_piece(self, drawer: DrawerId, file: str) -> None:
        self._state.drawers[drawer] = DrawerState(status="Ocupado", file=file)
        self._emit_state()

    def complete_active_job(self) -> None:
        """Job activo llegó a los 24s: lo cierra y activa el siguiente de la cola (D-10)."""
        self._state.job = None
        if self._state.queue:
            self._activate(self._state.queue.pop(0))
        else:
            self._emit_state()

    # ── Reset (botón Reiniciar, D-11) ───────────────────────────────────────
    def reset(self) -> None:
        self._state = initial_lab_state()
        self._emit({"type": "reset"})
        self._emit_state()


bus = Bus()
