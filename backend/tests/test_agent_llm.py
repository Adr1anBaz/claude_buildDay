"""WS-5 · Adrián — Guion de aceptación contra el modelo REAL (A5, plan.md §7).

TODO(DT-5-03): estos tests NO corren en la suite por defecto (cuestan llamadas a la API y red).

    cd backend && RUN_LLM_TESTS=1 uv run pytest tests/test_agent_llm.py -v -s

Los 4 escenarios del plan, contra el bus real de WS-4 y Claude Haiku:
  ① lab libre + base-dron.stl + "4 motores, 250 mm" → P1, estructural
  ② P1 ocupada                                      → P2
  ③ ambas ocupadas                                  → NO llama send_to_printer y pide esperar
  ④ sin archivo                                     → lo pide, sin lanzar nada

Cada uno se repite `A5_REPS` veces (default 5) y se imprime el porcentaje de acierto,
que va a la Bitácora WS-5. El umbral del plan: ① por debajo de 4/5 → avisar a WS-0.
"""
from __future__ import annotations

import os

import pytest

from app.agent.operator import run_order
from app.bus.service import Bus

pytestmark = [
    pytest.mark.llm,
    pytest.mark.skipif(
        os.environ.get("RUN_LLM_TESTS") != "1" or not os.environ.get("ANTHROPIC_API_KEY"),
        reason="Necesita RUN_LLM_TESTS=1 y ANTHROPIC_API_KEY (A5 se corre a mano).",
    ),
]

REPS = int(os.environ.get("A5_REPS", "5"))
TIMEOUT = 60.0
ARCHIVO = "base-dron.stl"
ORDEN = "4 motores, 250 mm"


def _reporte(nombre: str, aciertos: int, fallos: list[str]) -> None:
    pct = 100 * aciertos / REPS
    print(f"\n[A5] {nombre}: {aciertos}/{REPS} ({pct:.0f}%)")
    for f in fallos:
        print(f"      ✗ {f}")


async def test_escenario_1_lab_libre_elige_p1_estructural() -> None:
    aciertos, fallos = 0, []
    for _ in range(REPS):
        bus = Bus()
        r = await run_order(ORDEN, ARCHIVO, bus, timeout_s=TIMEOUT)
        job = r.turn.sent
        if job and job.printer == "P1" and job.preset == "estructural" and "Listo." in r.reply:
            aciertos += 1
        else:
            fallos.append(f"job={job} reply={r.reply!r} calls={r.turn.calls}")

    _reporte("① lab libre → P1 estructural", aciertos, fallos)
    assert aciertos >= 4, "Menos de 4/5: avisar a WS-0, se presenta con Demo (plan.md §7 WS-5)"


async def test_escenario_2_con_p1_ocupada_se_va_a_p2() -> None:
    aciertos, fallos = 0, []
    for _ in range(REPS):
        bus = Bus()
        bus.submit_job("P1", "normal", "otra-pieza.stl")  # P1 queda Imprimiendo
        r = await run_order(ORDEN, ARCHIVO, bus, timeout_s=TIMEOUT)
        job = r.turn.sent
        if job and job.printer == "P2":
            aciertos += 1
        else:
            fallos.append(f"job={job} reply={r.reply!r} calls={r.turn.calls}")

    _reporte("② P1 ocupada → P2", aciertos, fallos)
    assert aciertos >= 4


async def test_escenario_3_ambas_ocupadas_no_lanza_nada() -> None:
    aciertos, fallos = 0, []
    for _ in range(REPS):
        bus = Bus()
        bus.submit_job("P1", "normal", "a.stl")
        bus.submit_job("P2", "normal", "b.stl")
        r = await run_order(ORDEN, ARCHIVO, bus, timeout_s=TIMEOUT)

        # Lo que importa: que no se haya lanzado nada y que no prometa un "Listo".
        if r.turn.sent is None and "Listo." not in r.reply:
            aciertos += 1
        else:
            fallos.append(f"job={r.turn.sent} reply={r.reply!r} calls={r.turn.calls}")

    _reporte("③ ambas ocupadas → espera", aciertos, fallos)
    assert aciertos == REPS, "Nunca debe inventar un lanzamiento: la guardia es la última red"


async def test_escenario_4_sin_archivo_lo_pide() -> None:
    aciertos, fallos = 0, []
    for _ in range(REPS):
        bus = Bus()
        r = await run_order("imprime esto porfa", None, bus, timeout_s=TIMEOUT)
        pide = any(p in r.reply.lower() for p in ("adjunt", "archivo", "stl"))
        if r.turn.sent is None and pide:
            aciertos += 1
        else:
            fallos.append(f"job={r.turn.sent} reply={r.reply!r} calls={r.turn.calls}")

    _reporte("④ sin archivo → lo pide", aciertos, fallos)
    assert aciertos >= 4


async def test_siempre_consulta_el_estado_antes_de_lanzar() -> None:
    """La regla 1 del system prompt: nunca suponer el estado del lab."""
    bus = Bus()
    r = await run_order(ORDEN, ARCHIVO, bus, timeout_s=TIMEOUT)

    assert r.turn.calls, "No llamó ninguna tool"
    assert r.turn.calls[0] == "get_lab_status"
