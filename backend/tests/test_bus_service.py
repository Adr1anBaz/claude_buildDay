"""WS-4 · Fernando — Tests del bus core (tarea F1/F6), sin coreografía de tiempo.

`bus` es un singleton de proceso (plan.md D-04): cada test lo deja como lo
encontró con el fixture `_bus_limpio`.
"""
from __future__ import annotations

import pytest

from app.bus.service import bus
from app.contracts import DRAWER_IDS, DrawerState


@pytest.fixture(autouse=True)
def _bus_limpio():
    bus.reset()
    yield
    bus.reset()


async def test_p1_ocupada_rechaza_con_printer_busy() -> None:
    primero = bus.submit_job("P1", "normal", "a.stl")
    assert primero.ok is True

    segundo = bus.submit_job("P1", "normal", "b.stl")
    assert segundo.ok is False
    assert segundo.reason == "printer_busy"
    assert segundo.job is None


async def test_reserva_el_primer_cajon_libre_en_orden_1_a_4() -> None:
    r1 = bus.submit_job("P1", "normal", "a.stl")
    assert r1.job is not None
    assert r1.job.drawer == "cajon-1"

    r2 = bus.submit_job("P2", "normal", "b.stl")
    assert r2.job is not None
    assert r2.job.drawer == "cajon-2"

    estado = bus.get_status()
    assert estado.drawers["cajon-1"] == DrawerState(status="Reservado", file="a.stl")
    assert estado.drawers["cajon-2"] == DrawerState(status="Reservado", file="b.stl")


async def test_cuatro_cajones_llenos_da_no_drawer() -> None:
    # Se llenan los 4 cajones directamente: aísla la lógica de reserva de submit_job
    # de la coreografía completa (solo hay 2 impresoras para liberar cajones a mano).
    def _llenar(s):
        for d in DRAWER_IDS:
            s.drawers[d] = DrawerState(status="Ocupado", file="viejo.stl")

    bus.mutate(_llenar)

    resultado = bus.submit_job("P1", "normal", "nuevo.stl")
    assert resultado.ok is False
    assert resultado.reason == "no_drawer"
    assert resultado.job is None

    estado = bus.get_status()
    assert estado.noDrawer is True
    # La orden se rechazó: la impresora no debe quedar marcada como ocupada.
    assert estado.printers["P1"] == "Libre"


async def test_noDrawer_se_limpia_en_la_siguiente_orden_aceptada() -> None:
    def _llenar(s):
        for d in DRAWER_IDS:
            s.drawers[d] = DrawerState(status="Ocupado", file="viejo.stl")

    bus.mutate(_llenar)
    bus.submit_job("P1", "normal", "rechazado.stl")
    assert bus.get_status().noDrawer is True

    def _liberar_uno(s):
        s.drawers["cajon-3"] = DrawerState()

    bus.mutate(_liberar_uno)
    ok = bus.submit_job("P1", "normal", "aceptado.stl")
    assert ok.ok is True
    assert bus.get_status().noDrawer is False


async def test_reset_deja_el_estado_inicial() -> None:
    bus.submit_job("P1", "estructural", "x.stl")
    assert bus.get_status().job is not None

    bus.reset()
    estado = bus.get_status()
    assert estado.printers == {"P1": "Libre", "P2": "Libre"}
    assert estado.arm == "Reposo"
    assert all(d.status == "Libre" and d.file is None for d in estado.drawers.values())
    assert estado.job is None
    assert estado.queue == []
    assert estado.noDrawer is False
    assert estado.version == 0


async def test_version_sube_en_cada_cambio_de_estado() -> None:
    v0 = bus.get_status().version
    bus.submit_job("P1", "normal", "a.stl")
    v1 = bus.get_status().version
    assert v1 > v0

    bus.submit_job("P1", "normal", "rechazada.stl")  # printer_busy: no cambia el estado
    assert bus.get_status().version == v1


async def test_say_emite_un_evento_chat_a_los_suscriptores() -> None:
    eventos: list[dict] = []
    unsubscribe = bus.subscribe(eventos.append)
    try:
        bus.say("lab", "hola")
    finally:
        unsubscribe()

    assert len(eventos) == 1
    assert eventos[0]["type"] == "chat"
    assert eventos[0]["from"] == "lab"
    assert eventos[0]["text"] == "hola"
    assert isinstance(eventos[0]["ts"], int)


async def test_unsubscribe_detiene_las_notificaciones() -> None:
    eventos: list[dict] = []
    unsubscribe = bus.subscribe(eventos.append)
    unsubscribe()

    bus.say("lab", "no debería llegar")
    assert eventos == []


async def test_un_suscriptor_roto_no_tumba_al_bus() -> None:
    def _rompe(_evento: dict) -> None:
        raise RuntimeError("suscriptor roto a propósito")

    bus.subscribe(_rompe)
    # No debe lanzar, aunque el suscriptor de arriba reviente en cada evento.
    bus.say("lab", "sigue vivo")
