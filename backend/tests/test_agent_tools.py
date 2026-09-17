"""WS-5 · Adrián — Tarea A1: pruebas de las tools del agente.

Usan un FakeBus con la misma firma que plan.md §5.4 (`bus.get_status`,
`bus.submit_job`, `bus.say`, `bus.reset`, `bus.subscribe`), para no depender
de que `app/bus/service.py` (de WS-4) ya exista.
"""
from __future__ import annotations

from typing import Callable

import pytest

from app.agent import tools
from app.contracts import Job, LabState, SubmitResult, initial_lab_state


class FakeBus:
    """Bus falso con la firma de plan.md §5.4, para pruebas del agente."""

    def __init__(
        self,
        state: LabState | None = None,
        submit_result: SubmitResult | None = None,
    ) -> None:
        self.state = state or initial_lab_state()
        self._submit_result = submit_result
        self.said: list[tuple[str, str]] = []
        # Cada llamada a submit_job, para comprobar que el agente NO llama a
        # send_to_printer cuando no debe (p.ej. las dos impresoras ocupadas).
        self.submit_calls: list[tuple[str, str, str]] = []

    def get_status(self) -> LabState:
        return self.state

    def submit_job(self, printer: str, preset: str, file: str) -> SubmitResult:
        self.submit_calls.append((printer, preset, file))
        if self._submit_result is not None:
            return self._submit_result
        # Comportamiento por defecto: como el bus real (§5.4) — rechaza si la
        # impresora no está libre o si no hay cajón libre; si no, reserva el
        # primer cajón libre (1→4).
        if self.state.printers.get(printer) != "Libre":
            return SubmitResult(ok=False, reason="printer_busy")
        cajon = next((did for did, d in self.state.drawers.items() if d.status == "Libre"), None)
        if cajon is None:
            return SubmitResult(ok=False, reason="no_drawer")
        job = Job(id="job-1", file=file, preset=preset, printer=printer, drawer=cajon)
        return SubmitResult(ok=True, job=job)

    def say(self, from_: str, text: str) -> None:
        self.said.append((from_, text))

    def reset(self) -> None:
        self.state = initial_lab_state()

    def subscribe(self, callback: Callable[[object], None]) -> Callable[[], None]:
        return lambda: None


@pytest.fixture(autouse=True)
def _limpiar_bus():
    """Evita que un bus de una prueba se filtre a la siguiente."""
    yield
    tools.set_bus(None)


def test_get_lab_status_sin_bus_no_truena() -> None:
    tools.set_bus(None)
    resumen = tools.get_lab_status()
    assert "no disponible" in resumen.lower()


def test_get_lab_status_resumen_legible() -> None:
    bus = FakeBus()
    tools.set_bus(bus)

    resumen = tools.get_lab_status()

    assert "P1=Libre" in resumen
    assert "P2=Libre" in resumen
    assert "Reposo" in resumen  # brazo
    assert "cajon-1" in resumen and "cajon-4" in resumen
    assert "ninguno" in resumen  # sin job activo


def test_get_lab_status_incluye_job_activo() -> None:
    estado = initial_lab_state()
    estado.printers["P1"] = "Imprimiendo"
    estado.job = Job(id="j1", file="base-dron.stl", preset="estructural", printer="P1", drawer="cajon-1")
    bus = FakeBus(state=estado)
    tools.set_bus(bus)

    resumen = tools.get_lab_status()

    assert "base-dron.stl" in resumen
    assert "P1=Imprimiendo" in resumen


def test_send_to_printer_ok() -> None:
    job = Job(id="j1", file="base-dron.stl", preset="estructural", printer="P1", drawer="cajon-2")
    bus = FakeBus(submit_result=SubmitResult(ok=True, job=job))
    tools.set_bus(bus)

    texto = tools.send_to_printer("P1", "estructural", "base-dron.stl")

    assert texto == "OK: base-dron.stl a P1, preset estructural, cajón reservado cajon-2"


def test_send_to_printer_impresora_ocupada() -> None:
    bus = FakeBus(submit_result=SubmitResult(ok=False, reason="printer_busy"))
    tools.set_bus(bus)

    texto = tools.send_to_printer("P1", "normal", "x.stl")

    assert texto == "RECHAZADO: P1 está ocupada"


def test_send_to_printer_sin_cajon() -> None:
    bus = FakeBus(submit_result=SubmitResult(ok=False, reason="no_drawer"))
    tools.set_bus(bus)

    texto = tools.send_to_printer("P2", "fino", "x.stl")

    assert texto == "RECHAZADO: sin cajón libre"


def test_send_to_printer_sin_bus_no_truena() -> None:
    tools.set_bus(None)
    texto = tools.send_to_printer("P1", "normal", "x.stl")
    assert texto.startswith("RECHAZADO")
