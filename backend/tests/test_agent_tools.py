"""WS-5 · Adrián — Tests de las 2 tools del operador (A1).

Sin red y sin LLM: aquí se prueba el contrato entre el agente y el bus (§5.4).
"""
from __future__ import annotations

import inspect

import pytest

from app.agent.tools import Turn, build_tools
from app.bus.service import Bus
from app.contracts import DrawerState, Job, SubmitResult, initial_lab_state


class FakeBus:
    """Bus mínimo con la firma de §5.4, para controlar el estado sin tocar a WS-4."""

    def __init__(self, result: SubmitResult | None = None) -> None:
        self.state = initial_lab_state()
        self.result = result
        self.submitted: list[tuple[str, str, str]] = []
        self.said: list[tuple[str, str]] = []

    def get_status(self):
        return self.state

    def submit_job(self, printer, preset, file):
        self.submitted.append((printer, preset, file))
        if self.result is not None:
            return self.result
        # Como el bus real: cuando acepta, siempre devuelve el Job con su cajón ya asignado.
        job = Job(id="job-1", file=file, preset=preset, printer=printer, drawer="cajon-1")
        return SubmitResult(ok=True, job=job)

    def say(self, from_, text):
        self.said.append((from_, text))


def _tools(bus, turn: Turn):
    status, send = build_tools(bus, turn)
    return status, send


async def _call(t, **kwargs) -> str:
    """Invoca la tool por debajo del decorador de Strands."""
    return await t._tool_func(**kwargs)


# ── Las tools DEBEN ser async (si no, Strands las corre en otro hilo y rompe a WS-4) ──
def test_las_tools_son_corrutinas() -> None:
    status, send = _tools(FakeBus(), Turn())
    assert inspect.iscoroutinefunction(status._tool_func)
    assert inspect.iscoroutinefunction(send._tool_func)


# ── get_lab_status ────────────────────────────────────────────────────────────
async def test_status_lab_vacio() -> None:
    bus, turn = FakeBus(), Turn()
    status, _ = _tools(bus, turn)

    texto = await _call(status)

    assert "P1: Libre" in texto and "P2: Libre" in texto
    assert "Brazo: Reposo" in texto
    assert "Cajones libres: 4/4" in texto
    assert turn.calls == ["get_lab_status"]


async def test_status_avisa_cuando_no_hay_impresora_libre() -> None:
    bus, turn = FakeBus(), Turn()
    bus.state.printers["P1"] = "Imprimiendo"
    bus.state.printers["P2"] = "Imprimiendo"
    status, _ = _tools(bus, turn)

    texto = await _call(status)

    assert "NINGUNA impresora libre" in texto
    assert "Puedes enviar a" not in texto


async def test_status_avisa_cuando_no_hay_cajones() -> None:
    bus, turn = FakeBus(), Turn()
    for d in bus.state.drawers:
        bus.state.drawers[d] = DrawerState(status="Ocupado", file="x.stl")
    status, _ = _tools(bus, turn)

    texto = await _call(status)

    assert "Cajones libres: 0/4" in texto
    assert "reiniciar" in texto.lower()


# ── send_to_printer ───────────────────────────────────────────────────────────
async def test_send_ok_registra_el_job_real_en_el_turno() -> None:
    bus, turn = FakeBus(), Turn()
    _, send = _tools(bus, turn)

    texto = await _call(send, impresora="P1", preset="estructural", archivo="base-dron.stl")

    assert texto.startswith("OK:")
    assert bus.submitted == [("P1", "estructural", "base-dron.stl")]
    assert turn.sent is not None
    assert turn.sent.printer == "P1" and turn.sent.preset == "estructural"
    assert turn.calls == ["send_to_printer"]


async def test_send_impresora_ocupada_sugiere_la_otra() -> None:
    bus, turn = FakeBus(SubmitResult(ok=False, reason="printer_busy")), Turn()
    _, send = _tools(bus, turn)

    texto = await _call(send, impresora="P1", preset="normal", archivo="a.stl")

    assert texto.startswith("RECHAZADO:")
    assert "P2" in texto
    assert turn.sent is None
    assert turn.rejections == ["printer_busy"]


async def test_send_sin_cajon_prohibe_reintentar() -> None:
    bus, turn = FakeBus(SubmitResult(ok=False, reason="no_drawer")), Turn()
    _, send = _tools(bus, turn)

    texto = await _call(send, impresora="P1", preset="normal", archivo="a.stl")

    assert "sin cajón" in texto
    assert "No vuelvas a intentarlo" in texto
    assert turn.rejections == ["no_drawer"]


async def test_send_sin_archivo_no_toca_el_bus() -> None:
    bus, turn = FakeBus(), Turn()
    _, send = _tools(bus, turn)

    texto = await _call(send, impresora="P1", preset="normal", archivo="   ")

    assert texto.startswith("RECHAZADO:")
    assert bus.submitted == []
    assert turn.sent is None


# ── Contra el bus REAL de WS-4 (§5.4), sin fakes de por medio ─────────────────
@pytest.fixture
def bus_real():
    b = Bus()
    yield b
    b.reset()


async def test_contra_el_bus_real_el_lab_elige_el_cajon(bus_real: Bus) -> None:
    turn = Turn()
    status, send = _tools(bus_real, turn)

    texto = await _call(send, impresora="P1", preset="estructural", archivo="base-dron.stl")

    assert "cajón reservado cajon-1" in texto  # el agente nunca lo eligió
    assert bus_real.get_status().printers["P1"] == "Imprimiendo"

    # Y el estado que ve el agente después ya refleja la realidad.
    assert "P1: Imprimiendo" in await _call(status)


async def test_contra_el_bus_real_segunda_orden_a_p1_rebota(bus_real: Bus) -> None:
    turn = Turn()
    _, send = _tools(bus_real, turn)

    await _call(send, impresora="P1", preset="normal", archivo="a.stl")
    texto = await _call(send, impresora="P1", preset="normal", archivo="b.stl")

    assert "ocupada" in texto
    assert turn.sent is not None and turn.sent.file == "a.stl"  # se quedó el que SÍ pasó
