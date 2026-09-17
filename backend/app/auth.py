"""Contraseña única compartida (plan.md D-09, deuda DT-0-03).

Sin LAB_PASSWORD la autenticación queda apagada, que es el modo de desarrollo local.
"""
from __future__ import annotations

import hmac

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from itsdangerous import BadSignature, URLSafeSerializer

from .config import settings
from .contracts import LoginRequest

COOKIE = "lab_session"
PUBLIC_PATHS = ("/api/health", "/api/login", "/login")

router = APIRouter()
_serializer = URLSafeSerializer(settings.secret_key, salt="lab-session")


def _is_authed(request: Request) -> bool:
    token = request.cookies.get(COOKIE)
    if not token:
        return False
    try:
        return _serializer.loads(token) == "ok"
    except BadSignature:
        return False


async def auth_middleware(request: Request, call_next):
    if not settings.auth_enabled or request.url.path in PUBLIC_PATHS or _is_authed(request):
        return await call_next(request)
    if request.url.path.startswith("/api/") or request.url.path == "/ws":
        return JSONResponse({"detail": "No autorizado"}, status_code=401)
    return HTMLResponse(LOGIN_PAGE, status_code=401)


@router.post("/api/login")
async def login(body: LoginRequest, response: Response) -> dict[str, bool]:
    if not settings.auth_enabled:
        return {"ok": True}
    if not hmac.compare_digest(body.password, settings.lab_password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    response.set_cookie(COOKIE, _serializer.dumps("ok"), httponly=True, samesite="lax", max_age=60 * 60 * 12)
    return {"ok": True}


LOGIN_PAGE = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Lab Operador</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;background:#0f1115;color:#e6e8ee;display:grid;place-items:center;height:100vh;margin:0}
form{display:flex;flex-direction:column;gap:12px;width:280px}input,button{padding:10px;font:inherit;border-radius:6px;border:1px solid #2a2f3a}
input{background:#171a21;color:inherit}button{background:#3b82f6;color:#fff;border:0;cursor:pointer}p{color:#f87171;min-height:1em;margin:0;font-size:13px}</style>
</head><body><form id="f"><h1 style="font-size:18px;margin:0">Lab Operador</h1>
<input id="p" type="password" placeholder="Contraseña" autofocus><button>Entrar</button><p id="e"></p></form>
<script>document.getElementById('f').onsubmit=async(ev)=>{ev.preventDefault();
const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({password:document.getElementById('p').value})});
if(r.ok)location.reload();else document.getElementById('e').textContent='Contraseña incorrecta';};</script>
</body></html>"""
