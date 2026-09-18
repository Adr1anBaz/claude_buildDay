"""WS-5 · Adrián — Tests del operador (A2), sobre todo la guardia anti-alucinación (R1).

Sin red: aquí no se llama al modelo. Lo que se prueba es que, pase lo que pase con el LLM,
el usuario nunca lee un "Listo" que no ocurrió.
"""
from __future__ import annotations

import pytest

from app.agent import operator
from app.agent.operator import (
    AMBAS_OCUPADAS,
    NO_SE_LANZO,
    SIN_CAJON,
    build_prompt,
    finalize_reply,
)
from app.agent.tools import Turn
from app.contracts import Job


def _job(file: str = "base-dron.stl", printer: str = "P1", preset: str = "estructural") -> Job:
    return Job(id="job-1", file=file, preset=preset, printer=printer, drawer="cajon-1")


# ── Cuando SÍ se lanzó: la frase la construye el resultado, no el modelo ──────
def test_si_el_bus_acepto_la_frase_sale_del_job_real() -> None:
    turn = Turn(sent=_job())

    assert finalize_reply("lo que sea que haya dicho el modelo", turn) == (
        "Listo. base-dron.stl va a P1, preset estructural."
    )


def test_la_frase_usa_la_impresora_real_aunque_el_modelo_diga_otra() -> None:
    turn = Turn(sent=_job(printer="P2", preset="fino"))

    reply = finalize_reply("Listo. base-dron.stl va a P1, preset normal.", turn)

    assert reply == "Listo. base-dron.stl va a P2, preset fino."


# ── Cuando NO se lanzó: se bloquea cualquier afirmación de éxito ──────────────
@pytest.mark.parametrize(
    "alucinacion",
    [
        "Listo. base-dron.stl va a P1, preset estructural.",
        "Ya lo envié a la impresora P1.",
        "El archivo va a P2, preset fino.",
        "Tu pieza ya está imprimiendo en P1.",
        "Trabajo lanzado correctamente.",
    ],
)
def test_se_bloquea_el_exito_inventado(alucinacion: str) -> None:
    turn = Turn()

    assert finalize_reply(alucinacion, turn) == NO_SE_LANZO


def test_si_ambas_estaban_ocupadas_el_mensaje_explica_que_espere() -> None:
    turn = Turn(rejections=["printer_busy", "printer_busy"])

    assert finalize_reply("Listo, ya quedó.", turn) == AMBAS_OCUPADAS


def test_sin_cajon_manda_a_reiniciar_sin_importar_lo_que_diga_el_modelo() -> None:
    turn = Turn(rejections=["no_drawer"])

    assert finalize_reply("Listo. a.stl va a P1, preset normal.", turn) == SIN_CAJON


def test_respuesta_vacia_no_deja_al_usuario_sin_nada() -> None:
    assert finalize_reply("   ", Turn()) == NO_SE_LANZO


# ── Cuando NO se lanzó pero el modelo dice algo legítimo: se respeta ──────────
def test_pedir_el_archivo_pasa_tal_cual() -> None:
    turn = Turn(calls=["get_lab_status"])
    texto = "Necesito que adjuntes el archivo .stl para poder imprimir."

    assert finalize_reply(texto, turn) == texto


def test_decir_que_espere_pasa_tal_cual() -> None:
    turn = Turn(calls=["get_lab_status"])
    texto = "Las dos impresoras están ocupadas ahora mismo, espera a que una termine."

    assert finalize_reply(texto, turn) == texto


def test_la_respuesta_se_aplana_a_una_linea_sin_markdown() -> None:
    reply = finalize_reply("**Necesito**\n\nel   archivo\n.stl", Turn(calls=["get_lab_status"]))

    assert "\n" not in reply
    assert "*" not in reply
    assert reply == "Necesito el archivo .stl"


def test_la_respuesta_no_se_desborda() -> None:
    assert len(finalize_reply("Necesito el archivo. " * 100, Turn())) <= 240


# ── Prompt y configuración ───────────────────────────────────────────────────
def test_el_prompt_dice_el_archivo_para_que_no_lo_invente() -> None:
    assert "base-dron.stl" in build_prompt("4 motores, 250 mm", "base-dron.stl")


def test_el_prompt_dice_explicitamente_cuando_no_hay_archivo() -> None:
    assert "ninguno" in build_prompt("imprime algo", None)


def test_el_system_prompt_trae_las_reglas_que_no_se_pueden_perder() -> None:
    p = operator.SYSTEM_PROMPT

    assert "get_lab_status" in p and "send_to_printer" in p
    assert "estructural" in p and "fino" in p and "normal" in p
    assert "cajón" in p  # el agente no elige cajón
    assert "Libre" in p


def test_el_modelo_por_default_es_haiku(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)

    assert operator.model_id() == "claude-haiku-4-5"


def test_el_modelo_se_puede_cambiar_por_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")

    assert operator.model_id() == "claude-3-5-haiku-latest"


def test_sin_api_key_falla_claro_y_no_a_media_orden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        operator.make_model()


def test_el_modelo_se_reutiliza_entre_ordenes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un cliente HTTP por orden dejaba conexiones colgando y pagaba TLS cada vez."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-falsa")
    monkeypatch.setattr(operator, "_cache", None)

    assert operator.get_model() is operator.get_model()


def test_cambiar_de_modelo_invalida_el_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-falsa")
    monkeypatch.setattr(operator, "_cache", None)

    primero = operator.get_model()
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")

    assert operator.get_model() is not primero
