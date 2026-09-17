"""WS-5 · Adrián — Operador (agente). Tarea A1: las 2 herramientas del agente.

`get_lab_status` y `send_to_printer` son las únicas dos tools que el modelo
puede llamar. Ambas hablan con el bus (`app.bus.service.bus`, propiedad de
WS-4) a través de la API descrita en plan.md §5.4:

    bus.get_status() -> LabState
    bus.submit_job(printer, preset, file) -> SubmitResult
    bus.say(from_, text) -> None
    bus.reset() -> None
    bus.subscribe(callback) -> unsubscribe

IMPORTANTE: el agente NUNCA elige cajón. `submit_job` reserva el primer
cajón libre automáticamente (o rechaza con `no_drawer`); esta herramienta
solo reporta lo que el bus decidió.

`app/bus/service.py` lo está escribiendo WS-4 en paralelo: la importación de
`bus` es defensiva (no truena si el módulo todavía no existe). En producción
`operator.py`/`routes.py` inyectan el bus real con `set_bus`; en los tests se
inyecta un `FakeBus` con la misma firma.
"""
from __future__ import annotations

from typing import Any

try:  # pragma: no cover - depende de que WS-4 ya haya publicado el bus
    from ..bus.service import bus as _default_bus  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001 - service.py puede no existir todavía
    _default_bus = None

# Bus activo. Se sustituye con `set_bus` (producción: el bus real de WS-4;
# tests: un FakeBus con la misma firma que plan.md §5.4).
_bus: Any = _default_bus


def set_bus(bus_instance: Any) -> None:
    """Inyecta el bus que usarán las tools (real o `FakeBus` de pruebas)."""
    global _bus
    _bus = bus_instance


def get_lab_status() -> str:
    """Consulta el estado real del laboratorio.

    Devuelve un resumen compacto y legible: estado de las impresoras P1 y
    P2, del brazo, de los 4 cajones y del job activo (si hay uno). No
    recibe argumentos. Llama siempre a esta herramienta antes de decidir
    nada: nunca asumas que algo está libre sin comprobarlo aquí.
    """
    if _bus is None:
        return "Estado no disponible: el bus del laboratorio todavía no está listo."

    estado = _bus.get_status()

    impresoras = ", ".join(f"{pid}={status}" for pid, status in estado.printers.items())
    cajones = ", ".join(
        f"{did}={drawer.status}" + (f":{drawer.file}" if drawer.file else "")
        for did, drawer in estado.drawers.items()
    )

    if estado.job is not None:
        job = estado.job
        job_txt = f"{job.file} en {job.printer}, preset {job.preset}, fase {job.phase}"
    else:
        job_txt = "ninguno"

    return (
        f"Impresoras: {impresoras}. Brazo: {estado.arm}. "
        f"Cajones: {cajones}. Job actual: {job_txt}."
    )


def send_to_printer(impresora: str, preset: str, archivo: str) -> str:
    """Envía un trabajo de impresión al bus.

    Args:
        impresora: la impresora a usar, "P1" o "P2". Debe estar "Libre"
            según `get_lab_status` — llama esa herramienta primero.
        preset: "fino", "normal" o "estructural", según lo que pida el
            usuario.
        archivo: el nombre del archivo a imprimir.

    El bus reserva el primer cajón libre automáticamente: esta herramienta
    nunca elige el cajón, solo reporta el resultado. Puede rechazar el
    trabajo si la impresora está ocupada o si no hay cajón libre.
    """
    if _bus is None:
        return "RECHAZADO: el bus del laboratorio todavía no está listo."

    resultado = _bus.submit_job(impresora, preset, archivo)

    if resultado.ok and resultado.job is not None:
        return f"OK: {archivo} a {impresora}, preset {preset}, cajón reservado {resultado.job.drawer}"
    if resultado.reason == "printer_busy":
        return f"RECHAZADO: {impresora} está ocupada"
    if resultado.reason == "no_drawer":
        return "RECHAZADO: sin cajón libre"
    return "RECHAZADO: no se pudo enviar el trabajo"
