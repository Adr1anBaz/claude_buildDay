"""WS-5 · Adrián — Tarea A3/A4: pruebas de `/api/chat` y `/api/agent/health`.

Nunca llaman a la API real de Anthropic (eso costaría dinero): `operator
.run_operator` se sustituye con dobles de prueba vía monkeypatch. La prueba
que sí necesitaría la API real vive en `test_agent_integration.py`, marcada
con `@pytest.mark.skipif` cuando no hay `ANTHROPIC_API_KEY`.
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
from asgi_lifespan import LifespanManager  # type: ignore[import-not-found]

from app.agent import routes
from app.agent.operator import OperatorResult
from app.main import create_app

from .test_agent_tools import FakeBus


class FakeSettings:
    """Doble mínimo de `app.config.Settings`, solo con lo que routes.py usa."""

    def __init__(
        self,
        agent_enabled: bool = True,
        anthropic_model: str = "claude-opus-5",
        agent_timeout_s: float = 5.0,
    ) -> None:
        self.agent_enabled = agent_enabled
        self.anthropic_model = anthropic_model
        self.agent_timeout_s = agent_timeout_s


@pytest.fixture
async def client():
    app = create_app()
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


async def test_sin_api_key_responde_ok_false_sin_tronar(client: httpx.AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=False))

    res = await client.post("/api/chat", json={"text": "4 motores, 250 mm", "file": "base-dron.stl"})

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert "Demo" in body["reply"]


async def test_agent_health_sin_api_key(monkeypatch, client: httpx.AsyncClient) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=False, anthropic_model="claude-opus-5"))

    res = await client.get("/api/agent/health")

    assert res.status_code == 200
    assert res.json() == {"anthropic": False, "model": "claude-opus-5"}


async def test_guardia_anti_alucinacion_sustituye_listo_sin_ok(
    client: httpx.AsyncClient, monkeypatch
) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=True))
    bus = FakeBus()
    monkeypatch.setattr(routes, "_get_bus", lambda: bus)

    async def fabricado(text: str, file: str | None) -> OperatorResult:
        # El modelo afirma "Listo" pero printed_ok=False: send_to_printer NUNCA
        # devolvió OK en este turno. La guardia debe evitar que esto llegue al chat.
        return OperatorResult(reply="Listo. x.stl va a P1, preset normal.", printed_ok=False)

    monkeypatch.setattr(routes.operator, "run_operator", fabricado)

    res = await client.post("/api/chat", json={"text": "algo", "file": "x.stl"})

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "listo" not in body["reply"].lower()
    assert "Demo" in body["reply"]
    # El bus también recibió el mensaje seguro, no el alucinado.
    assert bus.said[-1] == ("operador", body["reply"])


async def test_listo_con_ok_real_no_se_sustituye(client: httpx.AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=True))
    bus = FakeBus()
    monkeypatch.setattr(routes, "_get_bus", lambda: bus)

    async def real(text: str, file: str | None) -> OperatorResult:
        return OperatorResult(reply="Listo. x.stl va a P1, preset normal.", printed_ok=True)

    monkeypatch.setattr(routes.operator, "run_operator", real)

    res = await client.post("/api/chat", json={"text": "algo", "file": "x.stl"})

    body = res.json()
    assert body["ok"] is True
    assert body["reply"] == "Listo. x.stl va a P1, preset normal."


async def test_error_del_operador_responde_ok_false(client: httpx.AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=True))
    bus = FakeBus()
    monkeypatch.setattr(routes, "_get_bus", lambda: bus)

    async def falla(text: str, file: str | None) -> OperatorResult:
        raise RuntimeError("la API de Anthropic no respondió")

    monkeypatch.setattr(routes.operator, "run_operator", falla)

    res = await client.post("/api/chat", json={"text": "algo", "file": "x.stl"})

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert "Demo" in body["reply"]


async def test_candado_devuelve_429_en_orden_simultanea(
    client: httpx.AsyncClient, monkeypatch
) -> None:
    monkeypatch.setattr(routes, "settings", FakeSettings(agent_enabled=True))
    bus = FakeBus()
    monkeypatch.setattr(routes, "_get_bus", lambda: bus)

    entro = asyncio.Event()
    soltar = asyncio.Event()

    async def lenta(text: str, file: str | None) -> OperatorResult:
        entro.set()
        await soltar.wait()
        return OperatorResult(reply="Listo. x.stl va a P1, preset normal.", printed_ok=True)

    monkeypatch.setattr(routes.operator, "run_operator", lenta)

    tarea1 = asyncio.create_task(
        client.post("/api/chat", json={"text": "primera", "file": "x.stl"})
    )
    await entro.wait()  # la primera orden ya tomó el candado y sigue en vuelo

    res2 = await client.post("/api/chat", json={"text": "segunda", "file": "y.stl"})
    assert res2.status_code == 429

    soltar.set()
    res1 = await tarea1
    assert res1.status_code == 200
