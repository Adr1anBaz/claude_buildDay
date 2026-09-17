"""CONTRATOS — espejo exacto de plan.md §5. CONGELADOS: solo WS-0 los cambia.

Su gemelo en TypeScript es frontend/src/contracts.ts (DT-0-06: se mantienen a mano).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ── §5.1 Tipos ────────────────────────────────────────────────────────────────
PrinterId = Literal["P1", "P2"]
DrawerId = Literal["cajon-1", "cajon-2", "cajon-3", "cajon-4"]
Preset = Literal["fino", "normal", "estructural"]
PrinterStatus = Literal["Libre", "Imprimiendo", "Lista"]
ArmStatus = Literal["Reposo", "En camino", "Con pieza"]
JobPhase = Literal["en_cola", "imprimiendo", "recogiendo", "guardando", "cerrando"]
ChatFrom = Literal["lab", "operador"]

PRINTER_IDS: tuple[PrinterId, ...] = ("P1", "P2")
DRAWER_IDS: tuple[DrawerId, ...] = ("cajon-1", "cajon-2", "cajon-3", "cajon-4")


class DrawerState(BaseModel):
    status: Literal["Libre", "Reservado", "Ocupado"] = "Libre"
    file: str | None = None


class Job(BaseModel):
    id: str
    file: str
    preset: Preset
    printer: PrinterId
    drawer: DrawerId
    phase: JobPhase = "en_cola"


class LabState(BaseModel):
    printers: dict[PrinterId, PrinterStatus]
    arm: ArmStatus = "Reposo"
    drawers: dict[DrawerId, DrawerState]
    job: Job | None = None
    queue: list[Job] = Field(default_factory=list)
    noDrawer: bool = False
    version: int = 0


def initial_lab_state() -> LabState:
    return LabState(
        printers={"P1": "Libre", "P2": "Libre"},
        arm="Reposo",
        drawers={d: DrawerState() for d in DRAWER_IDS},
    )


# ── §5.4 Resultado de bus.submit_job ──────────────────────────────────────────
SubmitReason = Literal["printer_busy", "no_drawer"]


class SubmitResult(BaseModel):
    ok: bool
    reason: SubmitReason | None = None
    job: Job | None = None


# ── §5.3 HTTP ─────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    text: str
    file: str | None = None


class ChatResponse(BaseModel):
    ok: bool
    reply: str


class LoginRequest(BaseModel):
    password: str


# ── §5.5 Línea de tiempo del job activo, en segundos ──────────────────────────
PRINT_DONE_S = 10.0
GRABBED_S = 14.0
STORED_S = 20.0
END_S = 24.0
