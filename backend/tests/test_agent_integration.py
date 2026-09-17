"""WS-5 · Adrián — Tarea A5: guion de aceptación contra la API real de Anthropic.

⚠️ Estas pruebas GASTAN dinero real (llaman a `AsyncAnthropic`): se saltan
automáticamente si no hay `ANTHROPIC_API_KEY` en el entorno.
"""
from __future__ import annotations

import os

import pytest

from app.agent import operator, tools
from app.contracts import initial_lab_state

from .test_agent_tools import FakeBus

pytestmark = pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="requiere ANTHROPIC_API_KEY (llama a la API real de Anthropic; cuesta dinero)",
)


@pytest.fixture(autouse=True)
def _limpiar_bus():
    yield
    tools.set_bus(None)


async def test_escenario_1_lab_libre_elige_impresora_y_preset_estructural() -> None:
    bus = FakeBus()
    tools.set_bus(bus)

    resultado = await operator.run_operator("4 motores, 250 mm", "base-dron.stl")

    assert resultado.printed_ok is True
    assert resultado.reply.startswith("Listo.")
    assert "estructural" in resultado.reply
    assert ("P1" in resultado.reply) or ("P2" in resultado.reply)


async def test_escenario_2_p1_ocupada_va_a_p2() -> None:
    estado = initial_lab_state()
    estado.printers["P1"] = "Imprimiendo"
    bus = FakeBus(state=estado)
    tools.set_bus(bus)

    resultado = await operator.run_operator("4 motores, 250 mm", "base-dron.stl")

    assert resultado.printed_ok is True
    assert "P2" in resultado.reply


async def test_escenario_3_ambas_ocupadas_no_llama_send_to_printer() -> None:
    estado = initial_lab_state()
    estado.printers["P1"] = "Imprimiendo"
    estado.printers["P2"] = "Imprimiendo"
    bus = FakeBus(state=estado)
    tools.set_bus(bus)

    resultado = await operator.run_operator("4 motores, 250 mm", "base-dron.stl")

    assert resultado.printed_ok is False
    assert "listo" not in resultado.reply.lower()
    assert bus.submit_calls == []


async def test_escenario_4_sin_archivo_lo_pide() -> None:
    bus = FakeBus()
    tools.set_bus(bus)

    resultado = await operator.run_operator("imprime esto por favor", None)

    assert resultado.printed_ok is False
    assert bus.submit_calls == []
