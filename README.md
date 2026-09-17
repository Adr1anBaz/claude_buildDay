# Lab Operador — Claude Build Day (Ibero)

Laboratorio de impresión 3D simulado que se opera sin tocar las máquinas: subes un `.stl`, dices para qué es, y un agente arma la orden, elige la impresora libre y lanza el trabajo. En pantalla se ve imprimir, un brazo recoge la pieza y la guarda en un cajón.

**El plan y el estado de cada workstream están en [`plan.md`](plan.md). Léelo antes de escribir código.**

## Empezar (cada quien con su agente)

```bash
git pull
/ws-start N        # 0 José Luis · 1 Daniela · 2 Elías · 3 Sebas · 4 Fernando · 5 Adrián
```

`/ws-start` crea tu rama y te muestra tu sección del plan. Las otras skills: `/plan-update` (mover una tarea), `/deuda` (registrar un atajo), `/ws-merge` (integrar a `main`). Reglas completas en `plan.md` §0.

## Correr en local

```bash
# Backend (un solo worker: el estado vive en memoria)
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# Frontend (Vite reenvía /api y /ws al backend)
cd frontend && npm install && npm run dev
```

**Sin backend:** `http://localhost:5173/?mock=1` simula el bus completo con la línea de tiempo de 24 s. Sirve para trabajar tu módulo aunque el servidor todavía no exista.

## Estructura

```
frontend/src/
  contracts.ts   contratos congelados (plan.md §5)
  main.ts        cableado entre módulos          net/  api, WebSocket y mock
  dashboard/ WS-1   lab/ WS-2   motion/ WS-3   status/ WS-4
backend/app/
  contracts.py   gemelo en Python de contracts.ts
  main.py        servidor           config.py  variables de entorno    auth.py  contraseña compartida
  bus/ WS-4      agent/ WS-5
```

Cada módulo es de su dueño (`plan.md` §4.3): no edites carpetas ajenas. Los archivos de `dashboard/`, `lab/`, `motion/`, `status/`, `bus/` y `agent/` son stubs que existen para que todo compile desde el primer día; reemplázalos conservando las firmas.

## Verificar antes de integrar

```bash
cd frontend && npm run typecheck
cd backend  && uv run pytest -q
```

`/ws-merge` los corre por ti y además valida que solo tocaste tus archivos.
