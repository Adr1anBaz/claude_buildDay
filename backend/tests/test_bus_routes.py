"""WS-4 · Fernando — Tests de bus/routes.py (F3 + F5 Demo)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.bus.service import bus
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_bus():
    bus.reset()
    yield
    bus.reset()


def test_get_state_inicial():
    r = client.get("/api/state")
    assert r.status_code == 200
    body = r.json()
    assert body["printers"] == {"P1": "Libre", "P2": "Libre"}
    assert body["job"] is None


def test_demo_lanza_job_a_p1():
    r = client.post("/api/demo")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    state = client.get("/api/state").json()
    assert state["printers"]["P1"] == "Imprimiendo"
    assert state["job"]["file"] == "base-dron.stl"
    assert state["job"]["preset"] == "estructural"


def test_demo_dos_veces_seguidas_choca_con_p1_ocupada():
    client.post("/api/demo")
    r = client.post("/api/demo")
    assert r.status_code == 409
    assert r.json()["detail"] == "printer_busy"


def test_reset_deja_estado_inicial():
    client.post("/api/demo")
    r = client.post("/api/reset")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["printers"] == {"P1": "Libre", "P2": "Libre"}
    assert state["job"] is None


def test_ws_manda_state_al_conectar():
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "state"
        assert msg["state"]["job"] is None


def test_ws_reenvia_eventos_del_bus():
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # state inicial
        client.post("/api/demo")
        msg = ws.receive_json()
        assert msg["type"] == "chat"
        assert msg["from"] == "lab"
