"""WS-4 · Fernando — Tests de bus/timeline.py (F2). TIMELINE_SCALE bajo para no esperar 24 s reales."""
from __future__ import annotations

import asyncio
from dataclasses import replace

import pytest

from app.bus import timeline
from app.bus.service import Bus
from app.config import settings
from app.contracts import END_S

SCALE = 0.02


@pytest.fixture(autouse=True)
def _scaled_timeline(monkeypatch: pytest.MonkeyPatch) -> None:
    # Settings es un dataclass frozen: se reemplaza el objeto, no se muta el campo.
    monkeypatch.setattr(timeline, "settings", replace(settings, timeline_scale=SCALE))


@pytest.fixture
def bus(monkeypatch: pytest.MonkeyPatch) -> Bus:
    fresh = Bus()
    monkeypatch.setattr(timeline, "bus", fresh)
    monkeypatch.setattr("app.bus.service.bus", fresh)
    timeline._registered = False
    timeline.register()
    return fresh


async def _wait_full_timeline() -> None:
    await asyncio.sleep(END_S * SCALE + 0.3)


async def test_job_unico_completa_la_secuencia_de_5_5(bus: Bus) -> None:
    result = bus.submit_job("P1", "estructural", "base-dron.stl")
    assert result.ok

    await _wait_full_timeline()

    s = bus.get_status()
    assert s.job is None
    assert s.arm == "Reposo"
    assert s.printers["P1"] == "Libre"
    assert s.drawers["cajon-1"].status == "Ocupado"
    assert s.drawers["cajon-1"].file == "base-dron.stl"


async def test_orden_de_fases_respeta_5_5(bus: Bus) -> None:
    fases: list[str] = []

    def on_event(event: dict) -> None:
        if event["type"] == "state" and event["state"].job is not None:
            fases.append(event["state"].job.phase)

    bus.subscribe(on_event)
    bus.submit_job("P1", "normal", "pieza.stl")
    await _wait_full_timeline()

    vistas = [f for i, f in enumerate(fases) if i == 0 or f != fases[i - 1]]
    assert vistas == ["en_cola", "imprimiendo", "recogiendo", "guardando", "cerrando"]


async def test_segundo_job_en_cola_arranca_solo_al_terminar_el_activo(bus: Bus) -> None:
    bus.submit_job("P1", "normal", "a.stl")
    bus.submit_job("P2", "normal", "b.stl")

    assert bus.get_status().job is not None
    assert bus.get_status().job.file == "a.stl"
    assert len(bus.get_status().queue) == 1

    await _wait_full_timeline()
    # el segundo (b.stl) se activó solo y ahora está corriendo su propia timeline
    assert bus.get_status().job is not None
    assert bus.get_status().job.file == "b.stl"
    assert bus.get_status().queue == []

    await _wait_full_timeline()
    s = bus.get_status()
    assert s.job is None
    assert s.drawers["cajon-2"].status == "Ocupado"
    assert s.drawers["cajon-2"].file == "b.stl"


async def test_reset_a_medio_job_cancela_la_timeline(bus: Bus) -> None:
    """DT-4-01: tras Reiniciar, la línea de tiempo vieja no debe tocar el estado nuevo (plan B del demo)."""
    chats: list[str] = []
    bus.subscribe(lambda e: chats.append(e["text"]) if e["type"] == "chat" else None)

    assert bus.submit_job("P1", "estructural", "base-dron.stl").ok
    await asyncio.sleep(12 * SCALE)  # a medio job: el brazo ya va por la pieza
    bus.reset()
    chats.clear()

    await _wait_full_timeline()

    s = bus.get_status()
    assert all(d.status == "Libre" for d in s.drawers.values())
    assert s.arm == "Reposo" and s.job is None and s.printers["P1"] == "Libre"
    assert chats == []  # nada de "Guardado en cajón 1." fantasma
