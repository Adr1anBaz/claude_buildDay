"""WS-5 · Adrián — Operador (agente). Tarea A2: el agente en sí.

Cambio de arquitectura respecto a plan.md §4.2/§4.3 (que menciona Strands +
Ollama + qwen3): eso quedó desactualizado. El operador usa ahora la API de
Anthropic directamente con el SDK oficial `anthropic` (AsyncAnthropic) y el
modelo configurado en `settings.anthropic_model` (por defecto claude-opus-5).

Bucle de herramientas: manual (no el tool runner del SDK, que es beta) para
tener control total sobre qué contó como éxito real — necesario para la
guardia anti-alucinación de `routes.py` (A3), que necesita saber si, EN ESE
TURNO, alguna llamada a `send_to_printer` devolvió "OK".

Sin memoria entre órdenes (D-15): cada llamada a `run_operator` arma una
conversación nueva desde cero.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic

from ..config import settings
from . import tools

# Tope de vueltas del bucle de herramientas: get_lab_status + send_to_printer
# (+ un reintento con la otra impresora) caben de sobra en esto; evita que un
# modelo errático se quede llamando tools indefinidamente.
MAX_ITERATIONS = 6

SYSTEM_PROMPT = """\
Eres el operador de un laboratorio de impresión 3D con dos impresoras (P1 y P2). \
Recibes una orden de un usuario (un texto y, opcionalmente, el nombre de un archivo \
.stl) y debes decidir qué impresora usar, qué preset aplicar, y lanzar el trabajo \
con tus herramientas. No eres un chatbot: eres un operador que solo actúa sobre el \
estado real del laboratorio.

Reglas estrictas, en este orden:

1. SIEMPRE llama primero a `get_lab_status` para conocer el estado real antes de \
decidir cualquier cosa. Nunca asumas que una impresora, cajón o recurso está libre \
sin haberlo comprobado ahí.
2. Si el usuario no indicó un archivo, pídeselo en tu respuesta y NO llames a \
`send_to_printer`.
3. Elige una impresora que el estado real diga que está "Libre".
4. Elige el preset según lo que describe el usuario:
   - "estructural" si menciona carga, motores, soportes o resistencia.
   - "fino" si menciona detalle, acabado o estética.
   - "normal" en cualquier otro caso.
5. Tú NUNCA eliges el cajón: el bus reserva el primer cajón libre automáticamente \
al llamar `send_to_printer`.
6. Llama a `send_to_printer` con la impresora, preset y archivo elegidos.
   - Si la herramienta responde "RECHAZADO" porque esa impresora está ocupada, \
intenta UNA vez con la OTRA impresora.
   - Si AMBAS impresoras están ocupadas (o la segunda también es rechazada por \
ocupada), NO vuelvas a llamar a `send_to_printer`: responde que hay que esperar a \
que una impresora quede libre.
   - Si te rechaza por falta de cajón, no reintentes: dilo en tu respuesta.
7. Responde SIEMPRE en una sola frase, en español.
   - Si `send_to_printer` respondió "OK" en este mismo turno, usa EXACTAMENTE este \
formato: "Listo. {archivo} va a {impresora}, preset {preset}."
   - Nunca digas "Listo" si `send_to_printer` no devolvió "OK" en este turno.
8. Nunca inventes que una impresora, cajón u otro recurso está libre o disponible: \
confía únicamente en lo que reportan tus herramientas.
"""

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "get_lab_status",
        "description": (
            "Devuelve el estado real del laboratorio: impresoras P1/P2, brazo, "
            "los 4 cajones y el job activo. Sin argumentos. Llámala siempre primero."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "send_to_printer",
        "description": (
            "Envía un archivo a imprimir en una impresora con un preset. El bus "
            "reserva el cajón automáticamente (el primero libre); esta tool nunca "
            "elige cajón."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "impresora": {
                    "type": "string",
                    "enum": ["P1", "P2"],
                    "description": "Impresora a usar.",
                },
                "preset": {
                    "type": "string",
                    "enum": ["fino", "normal", "estructural"],
                    "description": "Preset de impresión según lo que pida el usuario.",
                },
                "archivo": {
                    "type": "string",
                    "description": "Nombre del archivo a imprimir.",
                },
            },
            "required": ["impresora", "preset", "archivo"],
            "additionalProperties": False,
        },
    },
]

_TOOL_FUNCTIONS = {
    "get_lab_status": lambda **kwargs: tools.get_lab_status(),
    "send_to_printer": lambda **kwargs: tools.send_to_printer(**kwargs),
}


@dataclass
class OperatorResult:
    """Resultado de una corrida del agente."""

    reply: str
    # True si, EN ESTE TURNO, alguna llamada a send_to_printer devolvió "OK".
    # routes.py (A3) usa esto para la guardia anti-alucinación.
    printed_ok: bool


class OperatorError(RuntimeError):
    """Error al correr el agente (API caída, rechazo del modelo, etc.)."""


def _build_user_message(text: str, file: str | None) -> str:
    if file:
        return f"Archivo adjunto: {file}\nOrden del usuario: {text}"
    return "Archivo adjunto: (ninguno)\nOrden del usuario: " + text


def _run_tool(name: str, tool_input: dict[str, Any]) -> str:
    func = _TOOL_FUNCTIONS.get(name)
    if func is None:
        return f"RECHAZADO: herramienta desconocida '{name}'"
    # tool_input ya viene parseado como dict por el SDK (nunca por texto).
    return func(**tool_input)


async def run_operator(text: str, file: str | None) -> OperatorResult:
    """Corre el agente para UNA orden (sin memoria de órdenes anteriores).

    Levanta OperatorError si la API de Anthropic falla o el modelo rehúsa
    responder. El llamador (`routes.py`) es responsable del timeout global.
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": _build_user_message(text, file)}
    ]

    printed_ok = False
    last_text = ""

    for _ in range(MAX_ITERATIONS):
        try:
            response = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOL_DEFINITIONS,
                output_config={"effort": settings.agent_effort},
                messages=messages,
            )
        except Exception as exc:  # noqa: BLE001 - cualquier fallo de red/API es fatal aquí
            raise OperatorError(f"Error llamando a la API de Anthropic: {exc}") from exc

        # Comprobar stop_reason ANTES de leer el contenido (posible refusal).
        if response.stop_reason == "refusal":
            raise OperatorError("El modelo rehusó responder (stop_reason=refusal).")

        text_blocks = [block.text for block in response.content if block.type == "text"]
        if text_blocks:
            last_text = " ".join(t.strip() for t in text_blocks).strip()

        if response.stop_reason != "tool_use":
            # end_turn u otro motivo: no hay más tools que ejecutar.
            break

        # Debe preservarse el turno del asistente completo (incluye bloques
        # de thinking si los hubo) antes de mandar los tool_result.
        messages.append({"role": "assistant", "content": response.content})

        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        tool_results: list[dict[str, Any]] = []
        for block in tool_use_blocks:
            # block.input ya es un dict (JSON parseado por el SDK).
            result_text = _run_tool(block.name, block.input)
            if block.name == "send_to_printer" and result_text.startswith("OK:"):
                printed_ok = True
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_text,
                }
            )

        messages.append({"role": "user", "content": tool_results})
    else:
        # Se agotaron las iteraciones sin que el modelo terminara su turno.
        if not last_text:
            last_text = "No pude completar la orden. Intenta de nuevo o usa Demo."

    if not last_text:
        last_text = "No entendí la orden. Intenta de nuevo o usa Demo."

    return OperatorResult(reply=last_text, printed_ok=printed_ok)
