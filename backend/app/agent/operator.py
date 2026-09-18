"""WS-5 · Adrián — El operador: Strands + Claude Haiku (A2, plan.md §7).

Modelo: **Anthropic Haiku** vía `strands-agents[anthropic]` (ver Bitácora WS-5 del plan;
sustituye a Ollama/qwen3 de D-06, con SOLICITUD → WS-0 para actualizar §4.2 y §5.8).

Dos ideas sostienen la confiabilidad (R1 — que el modelo no alucine un "Listo"):

- **Un agente nuevo por orden** (D-15): sin memoria entre mensajes, sin estado que arrastrar.
- **La frase final no la redacta el modelo.** Si el bus aceptó el trabajo, la respuesta se
  construye desde el `Job` real (`finalize_reply`). Si no aceptó nada, se prohíbe cualquier
  afirmación de éxito. El modelo decide impresora y preset; el texto lo decide el resultado.
"""
from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from typing import Any, Callable

from strands import Agent
from strands.models.anthropic import AnthropicModel

from ..contracts import Job
from .tools import Turn, build_tools

# Se lee del entorno en cada llamada (no como constante de módulo) porque `config.py` es de
# WS-0 y no lo toco, y porque así los tests pueden cambiarlo con monkeypatch.
# TODO(DT-5-04): mover ANTHROPIC_API_KEY y ANTHROPIC_MODEL a config.Settings cuando WS-0 integre.
DEFAULT_MODEL_ID = "claude-haiku-4-5"

MAX_TURNS = 4
"""Tope de iteraciones del loop: status → send → (reintento en la otra impresora) → respuesta."""

MAX_TOKENS = 300

SYSTEM_PROMPT = """\
Eres el operador de un laboratorio de impresión 3D con dos impresoras (P1 y P2) y cuatro cajones.
Recibes órdenes cortas de una persona y las ejecutas. No eres un asistente de conversación.

Procedimiento, en este orden y sin saltarte pasos:
1. Llama SIEMPRE `get_lab_status` primero. Nunca supongas el estado del lab.
2. Si el usuario no adjuntó archivo, NO llames `send_to_printer`: pídele que adjunte el .stl.
3. Elige una impresora que aparezca como 'Libre' en el estado. Si las dos están Libres, usa P1.
4. Elige el preset según lo que pide el usuario:
   - `estructural`: si menciona carga, peso, motores, soportes, resistencia, drones o piezas funcionales.
   - `fino`: si menciona detalle, acabado, estética, precisión o piezas pequeñas.
   - `normal`: en cualquier otro caso.
5. Llama `send_to_printer` con la impresora, el preset y el nombre del archivo.
6. Si te responde 'RECHAZADO: ... está ocupada', intenta UNA vez con la otra impresora si está Libre.
7. Si NINGUNA impresora está Libre, NO llames `send_to_printer`: dile al usuario que espere a que una se libere.
8. Si te responde 'RECHAZADO: sin cajón', no reintentes: dile que reinicie el laboratorio.

Reglas de la respuesta final:
- Escribir texto NO imprime nada. Lo único que pone a imprimir es llamar `send_to_printer`.
  Si hay archivo y alguna impresora está Libre, DEBES llamarla antes de responder.
- Cuando `send_to_printer` te responda 'OK: ...', responde exactamente: Enviado.
- Si no llamaste `send_to_printer`, o te respondió 'RECHAZADO', explica en UNA frase qué ocurre:
  que espere a que se libere una impresora, que reinicie el laboratorio, o que adjunte el archivo.
- Una sola frase, en español, sin markdown, sin listas y sin emojis.
- Nunca digas que algo se envió, se lanzó o está imprimiendo si no recibiste 'OK'.
- Nunca digas que una impresora está libre si el estado no lo dice.
- Nunca menciones el cajón: lo asigna el laboratorio, no tú.

La confirmación que lee el usuario la redacta el laboratorio a partir del trabajo real,
así que no inventes ni adornes: tu trabajo es decidir impresora y preset, y llamar la herramienta.
"""


@dataclass
class OrderResult:
    """Resultado de procesar una orden."""

    reply: str
    """La frase que se le muestra al usuario (ya pasada por la guardia)."""

    turn: Turn
    """Lo que realmente ocurrió: tools llamadas, job aceptado, rechazos."""

    @property
    def launched(self) -> bool:
        return self.turn.sent is not None


# ── Configuración del modelo ──────────────────────────────────────────────────
def model_id() -> str:
    return os.environ.get("ANTHROPIC_MODEL") or DEFAULT_MODEL_ID


def api_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "")


def make_model() -> AnthropicModel:
    """Haiku, temperatura 0 y respuesta corta. Falla claro si no hay API key."""
    key = api_key()
    if not key:
        raise RuntimeError("Falta ANTHROPIC_API_KEY: el operador no puede trabajar.")
    return AnthropicModel(
        client_args={"api_key": key},
        model_id=model_id(),
        max_tokens=MAX_TOKENS,
        params={"temperature": 0},
    )


_cache: tuple[tuple[str, str], AnthropicModel] | None = None


def get_model() -> AnthropicModel:
    """El modelo se reutiliza entre órdenes; el `Agent` no (D-15).

    Cada `AnthropicModel` abre su propio cliente HTTP: crear uno por orden dejaba conexiones
    sin cerrar y hacía pagar el handshake TLS en cada mensaje del demo. La memoria del agente
    no vive aquí, vive en el `Agent`, así que compartir el modelo no comparte contexto.
    """
    global _cache
    llave = (api_key(), model_id())
    if _cache is None or _cache[0] != llave:
        _cache = (llave, make_model())
    return _cache[1]


async def ping() -> None:
    """Llamada mínima para confirmar credencial, modelo y red (warm-up de A4). Lanza si falla.

    Además deja la conexión TLS abierta, que es lo único "caliente" que hay que precalentar
    cuando el modelo es remoto: la primera orden del demo ya no la paga.
    """
    model = get_model()
    await model.client.messages.create(
        model=model_id(),
        max_tokens=1,
        messages=[{"role": "user", "content": "ok"}],
    )


def build_prompt(text: str, file: str | None) -> str:
    """El archivo va explícito para que el modelo no lo invente ni lo olvide."""
    adjunto = file if file else "ninguno"
    return f"Archivo adjunto: {adjunto}\nOrden del usuario: {text.strip()}"


# ── Ejecutar una orden ────────────────────────────────────────────────────────
def confirmacion(job: Job) -> str:
    """La única frase de éxito del sistema. Sale del job real, nunca del modelo (§5.5)."""
    return f"Listo. {job.file} va a {job.printer}, preset {job.preset}."


async def run_order(
    text: str,
    file: str | None,
    bus: Any,
    *,
    timeout_s: float,
    model: Any | None = None,
    on_launch: Callable[[Job], None] | None = None,
) -> OrderResult:
    """Corre el agente para UNA orden. Propaga TimeoutError o el error del proveedor.

    Quien llama (routes.py, A3) decide qué hacer con el fallo: aquí no se traga nada.
    """
    turn = Turn()
    agent = Agent(
        model=model if model is not None else get_model(),
        tools=build_tools(bus, turn, on_launch=on_launch),
        system_prompt=SYSTEM_PROMPT,
        callback_handler=None,  # sin impresión a stdout: esto corre dentro del servidor
    )

    result = await asyncio.wait_for(
        agent.invoke_async(build_prompt(text, file), limits={"turns": MAX_TURNS}),
        timeout=timeout_s,
    )

    return OrderResult(reply=finalize_reply(str(result), turn), turn=turn)


# ── Guardia anti-alucinación (A3) ─────────────────────────────────────────────
_EXITO_FALSO = re.compile(
    "|".join(
        [
            r"\blisto\b",
            # Formas que afirman una acción ya hecha: "lo envié", "fue enviado", "ya lo mandé".
            r"\benvi(?:é|ó|amos|ado|ada)\b",
            r"\bmand(?:é|ó|amos|ado|ada)\b",
            r"\blanc(?:é|ó|amos)\b",
            r"\blanzad[oa]\b",
            # Afirmaciones sobre una impresora concreta.
            r"\bva a (?:p1|p2)\b",
            r"\bqued[óo] en (?:p1|p2)\b",
            r"\bimprimiendo en (?:p1|p2)\b",
            r"\bya (?:est[áa] )?imprimiendo\b",
        ]
    ),
    re.IGNORECASE,
)

SIN_CAJON = "No hay cajones libres: reinicia el laboratorio para poder imprimir."
AMBAS_OCUPADAS = "Las dos impresoras están ocupadas. Espera a que una termine y vuelve a enviarlo."
NO_SE_LANZO = "No pude lanzar el trabajo: ninguna impresora lo aceptó."


def finalize_reply(raw: str, turn: Turn) -> str:
    """Convierte lo que dijo el modelo en lo que el usuario puede creer.

    Si el bus aceptó el trabajo, la frase se construye desde el `Job` real: el modelo ni
    siquiera participa. Si no aceptó nada, cualquier afirmación de éxito se sustituye.
    """
    if turn.sent is not None:
        return confirmacion(turn.sent)

    if "no_drawer" in turn.rejections:
        return SIN_CAJON

    texto = _una_linea(raw)

    if not texto:
        return AMBAS_OCUPADAS if "printer_busy" in turn.rejections else NO_SE_LANZO

    if _EXITO_FALSO.search(texto):
        # El modelo afirmó algo que no ocurrió: no se le deja pasar (R1).
        return AMBAS_OCUPADAS if "printer_busy" in turn.rejections else NO_SE_LANZO

    return texto


def _una_linea(raw: str) -> str:
    """Aplana la respuesta a una sola frase limpia: el chat es de una línea por mensaje."""
    texto = " ".join(raw.split())
    texto = re.sub(r"[*_`#]", "", texto).strip()
    return texto[:240].strip()
