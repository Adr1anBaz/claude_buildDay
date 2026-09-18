"""WS-5 · Adrián — Tests de POST /api/chat y /api/agent/health (A3, A4).

Sin LLM: se sustituye `operator.run_order` para probar lo que es responsabilidad de la ruta
(el candado, el timeout, el fallback y que TODO salga por el bus, D-14).
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.agent import routes
from app.agent.operator import OrderResult
from app.agent.tools import Turn
from app.bus.service import bus
from app.contracts import Job
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _lab_limpio():
    bus.reset()
    yield
    bus.reset()


@pytest.fixture
def chat_capturado():
    """Escucha el bus como lo haría el navegador por /ws."""
    lineas: list[tuple[str, str]] = []
    unsub = bus.subscribe(
        lambda e: lineas.append((e["from"], e["text"])) if e["type"] == "chat" else None
    )
    yield lineas
    unsub()


def _resultado(file: str = "base-dron.stl") -> OrderResult:
    job = Job(id="job-1", file=file, preset="estructural", printer="P1", drawer="cajon-1")
    return OrderResult(reply=f"Listo. {file} va a P1, preset estructural.", turn=Turn(sent=job))


# ── Camino feliz ──────────────────────────────────────────────────────────────
def test_chat_responde_y_publica_las_dos_lineas_en_el_bus(monkeypatch, chat_capturado) -> None:
    async def fake_run_order(text, file, bus_, **kwargs):
        resultado = _resultado(file or "base-dron.stl")
        # El agente real publica la confirmación en cuanto el bus acepta (§5.5).
        kwargs["on_launch"](resultado.turn.sent)
        return resultado

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)

    r = client.post("/api/chat", json={"text": "4 motores, 250 mm", "file": "base-dron.stl"})

    assert r.status_code == 200
    assert r.json() == {"ok": True, "reply": "Listo. base-dron.stl va a P1, preset estructural."}
    assert chat_capturado == [
        ("lab", "Recibido: base-dron.stl."),
        ("operador", "Listo. base-dron.stl va a P1, preset estructural."),
    ]


def test_la_confirmacion_no_se_publica_dos_veces(monkeypatch, chat_capturado) -> None:
    """Sale por `on_launch`; si routes la repitiera, el chat mostraría el Listo duplicado."""

    async def fake_run_order(text, file, bus_, **kwargs):
        resultado = _resultado("base-dron.stl")
        kwargs["on_launch"](resultado.turn.sent)
        return resultado

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)
    client.post("/api/chat", json={"text": "hola", "file": "base-dron.stl"})

    lineas_operador = [t for quien, t in chat_capturado if quien == "operador"]
    assert len(lineas_operador) == 1


def test_sin_archivo_el_recibido_no_dice_none(monkeypatch, chat_capturado) -> None:
    async def fake_run_order(text, file, bus_, **kwargs):
        return OrderResult(reply="Adjunta un archivo .stl.", turn=Turn())

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)

    r = client.post("/api/chat", json={"text": "imprime algo", "file": None})

    assert r.status_code == 200
    assert "None" not in chat_capturado[0][1]
    assert chat_capturado[0] == ("lab", "Recibido: orden sin archivo.")


def test_el_agente_recibe_el_bus_real(monkeypatch) -> None:
    visto = {}

    async def fake_run_order(text, file, bus_, **kwargs):
        visto["bus"] = bus_
        visto["timeout"] = kwargs.get("timeout_s")
        return _resultado()

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)
    client.post("/api/chat", json={"text": "hola", "file": "a.stl"})

    assert visto["bus"] is bus  # el bus de WS-4, no una copia
    assert visto["timeout"] > 0


# ── Una orden a la vez (D-15) ────────────────────────────────────────────────
async def test_429_mientras_hay_una_orden_en_vuelo(monkeypatch) -> None:
    import httpx
    from asgi_lifespan import LifespanManager

    from app.main import create_app

    suelta = asyncio.Event()

    async def fake_run_order(text, file, bus_, **kwargs):
        await suelta.wait()
        return _resultado()

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)

    app_ = create_app()
    async with LifespanManager(app_):
        transport = httpx.ASGITransport(app=app_)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            primera = asyncio.create_task(c.post("/api/chat", json={"text": "a", "file": "a.stl"}))
            await asyncio.sleep(0.05)  # deja que la primera tome el candado

            segunda = await c.post("/api/chat", json={"text": "b", "file": "b.stl"})
            assert segunda.status_code == 429

            suelta.set()
            assert (await primera).status_code == 200

            # El candado se libera: la siguiente orden pasa.
            tercera = await c.post("/api/chat", json={"text": "c", "file": "c.stl"})
            assert tercera.status_code == 200


# ── Fallos del modelo: nunca tumban la app, siempre mandan a Demo ────────────
def test_timeout_devuelve_ok_false_y_manda_a_demo(monkeypatch, chat_capturado) -> None:
    async def fake_run_order(text, file, bus_, **kwargs):
        raise asyncio.TimeoutError()

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)

    r = client.post("/api/chat", json={"text": "hola", "file": "a.stl"})

    assert r.status_code == 200
    assert r.json() == {"ok": False, "reply": routes.SIN_OPERADOR}
    assert ("lab", routes.SIN_OPERADOR) in chat_capturado


def test_error_del_proveedor_devuelve_ok_false(monkeypatch, chat_capturado) -> None:
    async def fake_run_order(text, file, bus_, **kwargs):
        raise RuntimeError("Falta ANTHROPIC_API_KEY: el operador no puede trabajar.")

    monkeypatch.setattr(routes.operator, "run_order", fake_run_order)

    r = client.post("/api/chat", json={"text": "hola", "file": "a.stl"})

    assert r.status_code == 200
    assert r.json()["ok"] is False
    assert ("lab", routes.SIN_OPERADOR) in chat_capturado


def test_un_fallo_no_deja_el_candado_trabado(monkeypatch) -> None:
    async def explota(text, file, bus_, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(routes.operator, "run_order", explota)
    client.post("/api/chat", json={"text": "hola", "file": "a.stl"})

    async def bien(text, file, bus_, **kwargs):
        return _resultado()

    monkeypatch.setattr(routes.operator, "run_order", bien)
    r = client.post("/api/chat", json={"text": "hola", "file": "a.stl"})

    assert r.json()["ok"] is True


# ── Health (A4) ──────────────────────────────────────────────────────────────
def test_health_devuelve_las_llaves_del_contrato() -> None:
    body = client.get("/api/agent/health").json()

    assert set(body) >= {"ollama", "model"}  # §5.3 congelado
    assert isinstance(body["ollama"], bool)
    assert body["provider"] == "anthropic"
    assert "haiku" in body["model"]


async def test_warmup_sin_api_key_no_rompe_el_arranque(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    await routes._warmup()

    assert routes._llm_ok is False


async def test_warmup_marca_el_operador_disponible(monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-falsa")

    async def ping_ok():
        return None

    monkeypatch.setattr(routes.operator, "ping", ping_ok)
    await routes._warmup()

    assert routes._llm_ok is True
