"""WS-4 · Fernando — Tests de bus/service.py (F1)."""
from __future__ import annotations

from app.bus.service import Bus


def test_estado_inicial() -> None:
    bus = Bus()
    s = bus.get_status()
    assert s.printers == {"P1": "Libre", "P2": "Libre"}
    assert s.arm == "Reposo"
    assert all(d.status == "Libre" for d in s.drawers.values())
    assert s.job is None
    assert s.queue == []
    assert s.noDrawer is False


def test_submit_job_activa_de_inmediato_si_no_hay_job_activo() -> None:
    bus = Bus()
    result = bus.submit_job("P1", "estructural", "base-dron.stl")
    assert result.ok
    assert result.job is not None
    assert result.job.printer == "P1"
    assert result.job.drawer == "cajon-1"
    s = bus.get_status()
    assert s.job == result.job
    assert s.printers["P1"] == "Imprimiendo"
    assert s.drawers["cajon-1"].status == "Reservado"


def test_printer_ocupada_rechaza() -> None:
    bus = Bus()
    bus.submit_job("P1", "normal", "a.stl")
    result = bus.submit_job("P1", "normal", "b.stl")
    assert not result.ok
    assert result.reason == "printer_busy"


def test_segunda_orden_a_otra_impresora_hace_cola_y_reserva_cajon() -> None:
    bus = Bus()
    bus.submit_job("P1", "normal", "a.stl")
    result = bus.submit_job("P2", "normal", "b.stl")
    assert result.ok
    s = bus.get_status()
    assert s.printers["P2"] == "Imprimiendo"  # D-10: pasa a Imprimiendo de inmediato
    assert s.job is not None and s.job.file == "a.stl"  # sigue animando el primero
    assert len(s.queue) == 1 and s.queue[0].file == "b.stl"
    assert s.drawers["cajon-2"].status == "Reservado"  # cajón se reserva al lanzar (D-11)


def test_cuatro_cajones_llenos_rechaza_sin_cajon() -> None:
    bus = Bus()
    for i, cajon in enumerate(["cajon-1", "cajon-2", "cajon-3", "cajon-4"], start=1):
        bus.store_piece(cajon, f"llenado-{i}.stl")  # type: ignore[arg-type]
    result = bus.submit_job("P1", "normal", "nuevo.stl")
    assert not result.ok
    assert result.reason == "no_drawer"
    assert bus.get_status().noDrawer is True


def test_complete_active_job_activa_el_siguiente_de_la_cola() -> None:
    bus = Bus()
    bus.submit_job("P1", "normal", "a.stl")
    bus.submit_job("P2", "normal", "b.stl")
    eventos: list[dict] = []
    bus.subscribe(lambda e: eventos.append(e))

    bus.complete_active_job()

    s = bus.get_status()
    assert s.job is not None and s.job.file == "b.stl"
    assert s.queue == []
    assert any(e["type"] == "job_started" and e["job"].file == "b.stl" for e in eventos)


def test_complete_active_job_sin_cola_deja_job_none() -> None:
    bus = Bus()
    bus.submit_job("P1", "normal", "a.stl")
    bus.complete_active_job()
    assert bus.get_status().job is None


def test_reset_deja_estado_inicial() -> None:
    bus = Bus()
    bus.submit_job("P1", "normal", "a.stl")
    bus.reset()
    s = bus.get_status()
    assert s.job is None
    assert s.printers == {"P1": "Libre", "P2": "Libre"}
    assert all(d.status == "Libre" for d in s.drawers.values())


def test_reset_emite_reset_y_state() -> None:
    bus = Bus()
    eventos: list[dict] = []
    bus.subscribe(lambda e: eventos.append(e))
    bus.reset()
    tipos = [e["type"] for e in eventos]
    assert tipos == ["reset", "state"]


def test_say_emite_evento_chat() -> None:
    bus = Bus()
    eventos: list[dict] = []
    bus.subscribe(lambda e: eventos.append(e))
    bus.say("operador", "Listo. a.stl va a P1, preset normal.")
    assert eventos[-1]["type"] == "chat"
    assert eventos[-1]["from"] == "operador"


def test_subscribe_devuelve_unsubscribe_funcional() -> None:
    bus = Bus()
    eventos: list[dict] = []
    unsubscribe = bus.subscribe(lambda e: eventos.append(e))
    unsubscribe()
    bus.say("lab", "no debería llegar")
    assert eventos == []


def test_version_sube_en_cada_cambio() -> None:
    bus = Bus()
    v0 = bus.get_status().version
    bus.submit_job("P1", "normal", "a.stl")
    v1 = bus.get_status().version
    assert v1 > v0
