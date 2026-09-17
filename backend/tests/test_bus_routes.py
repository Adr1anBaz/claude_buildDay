"""WS-4 · Fernando — Tests de /api/state y /ws (tarea F3).

Usa `TestClient` (síncrono) para el WebSocket: su `websocket_connect` maneja el
loop de eventos por su cuenta, así que no compite con el loop de pytest-asyncio
de los demás módulos de test.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.bus import timeline as timeline_module
from app.bus.service import bus
from app.config import Settings
from app.contracts import LabState
from app.main import create_app


@pytest.fixture(autouse=True)
def _bus_limpio():
    bus.reset()
    yield
    bus.reset()


async def test_get_state_devuelve_el_estado_real_del_bus() -> None:
    bus.submit_job("P1", "fino", "pieza.stl")

    from app.bus.routes import get_state

    estado = await get_state()
    assert isinstance(estado, LabState)
    assert estado.job is not None
    assert estado.job.file == "pieza.stl"
    assert estado.printers["P1"] == "Imprimiendo"


def test_ws_manda_state_al_conectar() -> None:
    app = create_app()
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        mensaje = ws.receive_json()
        assert mensaje["type"] == "state"
        assert mensaje["state"]["printers"] == {"P1": "Libre", "P2": "Libre"}
        assert mensaje["state"]["job"] is None


def test_ws_reenvia_el_primer_evento_de_una_orden_a_un_cliente_conectado(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(timeline_module, "settings", Settings(timeline_scale=0.02))
    app = create_app()
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        inicial = ws.receive_json()
        assert inicial["type"] == "state"

        res = client.post("/api/demo")
        assert res.status_code == 200

        # Lo primero que hace /api/demo es `say('lab', 'Recibido: ...')`.
        primero = ws.receive_json()
        assert primero == {
            "type": "chat",
            "from": "lab",
            "text": "Recibido: base-dron.stl.",
            "ts": primero["ts"],
        }

        # Después reserva impresora/cajón: el siguiente evento es el nuevo estado.
        segundo = ws.receive_json()
        assert segundo["type"] == "state"
        assert segundo["state"]["job"]["file"] == "base-dron.stl"


def test_ws_no_rompe_el_servidor_si_el_cliente_se_desconecta() -> None:
    app = create_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()
        # Al salir del `with` el cliente cierra la conexión; el servidor debe seguir
        # respondiendo con normalidad a otros clientes.
        with client.websocket_connect("/ws") as ws2:
            otro = ws2.receive_json()
            assert otro["type"] == "state"

        res = client.get("/api/state")
        assert res.status_code == 200
