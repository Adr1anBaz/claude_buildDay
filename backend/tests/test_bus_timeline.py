"""WS-4 · Fernando — Tests de la línea de tiempo y la cola (tareas F2, F5, F6).

Usa un `TIMELINE_SCALE` bajo (monkeypatch del `settings` que ve `timeline.py`,
no la variable de entorno: `Settings` es un dataclass congelado) para no
esperar los 24 s reales del demo en cada corrida.
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
from asgi_lifespan import LifespanManager  # type: ignore[import-not-found]

from app.bus import timeline as timeline_module
from app.bus.service import bus
from app.config import Settings
from app.contracts import DRAWER_IDS, DrawerState
from app.main import create_app

ESCALA_RAPIDA = 0.02  # 24 s de demo → ~0.48 s reales
MARGEN_S = 0.35  # colchón sobre la duración teórica para no ser flaky


@pytest.fixture(autouse=True)
def _bus_limpio():
    bus.reset()
    yield
    bus.reset()


@pytest.fixture(autouse=True)
def _timeline_rapida(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(timeline_module, "settings", Settings(timeline_scale=ESCALA_RAPIDA))
    yield


@pytest.fixture
async def client():
    app = create_app()
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


async def _esperar_una_coreografia() -> None:
    await asyncio.sleep(24 * ESCALA_RAPIDA + MARGEN_S)


async def test_secuencia_completa_de_la_linea_de_tiempo_en_orden() -> None:
    eventos: list[dict] = []
    unsubscribe = bus.subscribe(eventos.append)
    try:
        resultado = bus.submit_job("P1", "normal", "pieza.stl")
        assert resultado.ok is True
        await _esperar_una_coreografia()
    finally:
        unsubscribe()

    # Fases del job activo, en el orden en que deben aparecer (sin retroceder).
    fases = [
        e["state"]["job"]["phase"]
        for e in eventos
        if e["type"] == "state" and e["state"]["job"] is not None
    ]
    vistas_sin_repetir = [f for i, f in enumerate(fases) if i == 0 or f != fases[i - 1]]
    assert vistas_sin_repetir == ["en_cola", "imprimiendo", "recogiendo", "guardando", "cerrando"]

    tipos = [e["type"] for e in eventos]
    assert tipos.count("job_started") == 1  # nunca dos jobs activos a la vez

    textos = [e["text"] for e in eventos if e["type"] == "chat"]
    assert "Imprimiendo en P1…" in textos
    assert "Recogiendo pieza de P1…" in textos
    assert "Guardado en cajón 1." in textos

    estado_final = bus.get_status()
    assert estado_final.job is None
    assert estado_final.arm == "Reposo"
    assert estado_final.drawers["cajon-1"].status == "Ocupado"
    assert estado_final.drawers["cajon-1"].file == "pieza.stl"


async def test_segunda_orden_a_otra_impresora_hace_cola_y_arranca_sola() -> None:
    r1 = bus.submit_job("P1", "normal", "uno.stl")
    assert r1.ok and r1.job is not None

    r2 = bus.submit_job("P2", "fino", "dos.stl")
    assert r2.ok and r2.job is not None

    estado = bus.get_status()
    # D-10: P2 ya se ve "Imprimiendo" y su cajón reservado, pero el activo sigue siendo el 1.
    assert estado.printers["P2"] == "Imprimiendo"
    assert estado.drawers[r2.job.drawer].status == "Reservado"
    assert estado.job is not None and estado.job.id == r1.job.id
    assert [j.id for j in estado.queue] == [r2.job.id]
    assert estado.queue[0].phase == "en_cola"

    await _esperar_una_coreografia()

    a_medio_camino = bus.get_status()
    assert a_medio_camino.queue == []
    assert a_medio_camino.job is not None
    assert a_medio_camino.job.id == r2.job.id
    assert a_medio_camino.job.printer == "P2"

    await _esperar_una_coreografia()

    final = bus.get_status()
    assert final.job is None
    assert final.drawers[r2.job.drawer].status == "Ocupado"
    assert final.drawers[r2.job.drawer].file == "dos.stl"


async def test_demo_arranca_el_ciclo_y_rechaza_con_409_si_p1_ocupada(client: httpx.AsyncClient) -> None:
    res1 = await client.post("/api/demo")
    assert res1.status_code == 200
    assert res1.json() == {"ok": True}

    estado = (await client.get("/api/state")).json()
    assert estado["job"]["printer"] == "P1"
    assert estado["job"]["file"] == "base-dron.stl"
    assert estado["printers"]["P1"] == "Imprimiendo"

    # P1 sigue ocupada por la orden anterior: demo NO la interrumpe, responde 409.
    res2 = await client.post("/api/demo")
    assert res2.status_code == 409

    # El estado del job original sigue intacto.
    estado_tras_rechazo = (await client.get("/api/state")).json()
    assert estado_tras_rechazo["job"]["file"] == "base-dron.stl"


async def test_demo_responde_409_sin_cajon_libre(client: httpx.AsyncClient) -> None:
    def _llenar(s):
        for d in DRAWER_IDS:
            s.drawers[d] = DrawerState(status="Ocupado", file="viejo.stl")

    bus.mutate(_llenar)

    res = await client.post("/api/demo")
    assert res.status_code == 409


async def test_reset_endpoint_limpia_el_estado(client: httpx.AsyncClient) -> None:
    await client.post("/api/demo")
    assert (await client.get("/api/state")).json()["job"] is not None

    res = await client.post("/api/reset")
    assert res.status_code == 200

    estado = (await client.get("/api/state")).json()
    assert estado["job"] is None
    assert estado["queue"] == []
    assert estado["printers"] == {"P1": "Libre", "P2": "Libre"}
    assert estado["noDrawer"] is False
