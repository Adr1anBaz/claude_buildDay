"""Pruebas de la plataforma (WS-0). WS-4 y WS-5 agregan las suyas en test_bus_* y test_agent_*."""
from __future__ import annotations

import httpx
import pytest
from asgi_lifespan import LifespanManager  # type: ignore[import-not-found]

from app.contracts import LabState, initial_lab_state
from app.main import create_app


@pytest.fixture
async def client():
    app = create_app()
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


async def test_health(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


async def test_state_devuelve_el_contrato(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/state")
    assert res.status_code == 200
    LabState.model_validate(res.json())


def test_estado_inicial_todo_libre() -> None:
    s = initial_lab_state()
    assert s.printers == {"P1": "Libre", "P2": "Libre"}
    assert s.arm == "Reposo"
    assert all(d.status == "Libre" and d.file is None for d in s.drawers.values())
    assert s.job is None and s.queue == [] and s.noDrawer is False
