"""Servidor del Lab Operador (WS-0).

Sirve el frontend construido y monta los routers de cada workstream.
IMPORTANTE: un solo worker de uvicorn — el bus vive en memoria (plan.md D-04, deuda DT-0-01).
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import auth
from .agent.routes import router as agent_router
from .bus.routes import router as bus_router
from .config import settings

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(title="Lab Operador", docs_url="/api/docs")
    app.middleware("http")(auth.auth_middleware)

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        return {"ok": True, "auth": settings.auth_enabled}

    app.include_router(auth.router)
    app.include_router(bus_router)
    app.include_router(agent_router)

    if DIST.is_dir():
        app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
    else:
        @app.get("/")
        async def sin_build() -> dict[str, str]:
            return {"detail": "Falta el build del frontend: cd frontend && npm run build (en dev usa http://localhost:5173)"}

    return app


app = create_app()
