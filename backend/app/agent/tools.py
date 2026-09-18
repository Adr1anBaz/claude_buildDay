"""WS-5 · Adrián — Las 2 tools del operador (A1, plan.md §7).

El agente solo puede hacer dos cosas: *mirar* el lab y *lanzar* un trabajo.
Todo lo demás (elegir cajón, mover el brazo, avanzar el tiempo) es de WS-4.

Dos reglas de diseño que no son negociables:

1. **Las tools son `async def`.** Strands ejecuta las tools síncronas en
   `asyncio.to_thread` (`strands/tools/decorator.py:654`). Desde un hilo sin event
   loop, `bus.submit_job` rompería a WS-4: su `timeline` hace `asyncio.create_task`
   y el hub de `/ws` escribe en un `asyncio.Queue` (que no es thread-safe).
   Con `async def`, Strands las corre en el loop principal.

2. **Se construyen por orden con `build_tools(bus, turn)`.** El `Turn` guarda lo que
   de verdad pasó en esta orden: es la fuente del texto que ve el usuario y la base
   de la guardia anti-alucinación de A3. El agente nunca redacta el "Listo".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from strands import tool

from ..contracts import DRAWER_IDS, PRINTER_IDS, Job, SubmitResult


@dataclass
class Turn:
    """Lo que ocurrió durante UNA orden. Vive lo que vive la petición (D-15: sin memoria)."""

    calls: list[str] = field(default_factory=list)
    """Nombres de las tools llamadas, en orden. Lo usa A5 para medir el comportamiento."""

    sent: Job | None = None
    """El job que el bus aceptó de verdad. Si es None, NADA se lanzó: prohibido decir "Listo"."""

    rejections: list[str] = field(default_factory=list)
    """Razones de los rechazos del bus (`printer_busy`, `no_drawer`)."""


def build_tools(
    bus: Any,
    turn: Turn,
    on_launch: Callable[[Job], None] | None = None,
) -> list[Any]:
    """Crea las tools atadas a este bus y a este turno.

    `bus` se recibe por parámetro (no se importa) para poder pasar un `FakeBus` en los
    tests con la firma de §5.4, sin monkeypatch y sin tocar el bus real de WS-4.

    `on_launch` se dispara en el instante en que el bus acepta el trabajo, no cuando el
    modelo termina de hablar: así la línea del operador sale antes que las de la línea de
    tiempo, como en §5.5, y el chat del agente se ve igual que el del botón Demo (D-14).
    """

    @tool
    async def get_lab_status() -> str:
        """Consulta el estado actual del laboratorio: impresoras, brazo y cajones.

        Llama SIEMPRE esta herramienta antes de enviar nada a imprimir.

        Returns:
            Un resumen en una línea con el estado de cada impresora, del brazo y de los cajones.
        """
        turn.calls.append("get_lab_status")
        return _resumen(bus.get_status())

    @tool
    async def send_to_printer(
        impresora: Literal["P1", "P2"],
        preset: Literal["fino", "normal", "estructural"],
        archivo: str,
    ) -> str:
        """Lanza un trabajo de impresión en la impresora indicada.

        El cajón lo elige el laboratorio: tú nunca lo decides ni lo mencionas.
        Solo llama esta herramienta si la impresora aparece como 'Libre' en el estado.

        Args:
            impresora: 'P1' o 'P2'. Debe estar Libre.
            preset: 'fino' (detalle o estética), 'estructural' (carga, motores, soportes)
                o 'normal' (cualquier otro caso).
            archivo: Nombre del archivo .stl que adjuntó el usuario.

        Returns:
            'OK: …' si el laboratorio aceptó el trabajo, o 'RECHAZADO: …' con el motivo.
        """
        turn.calls.append("send_to_printer")

        if not archivo or not archivo.strip():
            return "RECHAZADO: no hay archivo. Pídele al usuario que adjunte un .stl."

        result: SubmitResult = bus.submit_job(impresora, preset, archivo.strip())

        if result.ok and result.job is not None:
            turn.sent = result.job
            if on_launch is not None:
                on_launch(result.job)
            return (
                f"OK: {result.job.file} en {result.job.printer}, preset {result.job.preset}, "
                f"cajón reservado {result.job.drawer}."
            )

        reason = result.reason or "desconocido"
        turn.rejections.append(reason)

        if reason == "printer_busy":
            otra = "P2" if impresora == "P1" else "P1"
            return (
                f"RECHAZADO: {impresora} está ocupada. Consulta el estado otra vez: "
                f"si {otra} está Libre, envíalo ahí; si no, dile al usuario que espere."
            )
        if reason == "no_drawer":
            return (
                "RECHAZADO: sin cajón. Los 4 cajones están llenos y no se puede imprimir nada. "
                "Dile al usuario que reinicie el laboratorio. No vuelvas a intentarlo."
            )
        return f"RECHAZADO: {reason}."

    return [get_lab_status, send_to_printer]


def _resumen(state: Any) -> str:
    """Estado del lab en una línea, pensado para que un modelo chico no se confunda."""
    impresoras = " · ".join(f"{p}: {state.printers[p]}" for p in PRINTER_IDS)

    libres = [d for d in DRAWER_IDS if state.drawers[d].status == "Libre"]
    if libres:
        cajones = f"Cajones libres: {len(libres)}/{len(DRAWER_IDS)}"
    else:
        cajones = "Cajones libres: 0/4 (NO se puede imprimir: hay que reiniciar el lab)"

    partes = [impresoras, f"Brazo: {state.arm}", cajones]

    if state.job is not None:
        partes.append(f"Trabajo en curso: {state.job.file} en {state.job.printer}")
    if state.queue:
        partes.append(f"En cola: {len(state.queue)}")

    disponibles = [p for p in PRINTER_IDS if state.printers[p] == "Libre"]
    if not disponibles:
        partes.append("NINGUNA impresora libre: no envíes nada, pide que espere")
    elif libres:
        partes.append(f"Puedes enviar a: {', '.join(disponibles)}")

    return " · ".join(partes)
