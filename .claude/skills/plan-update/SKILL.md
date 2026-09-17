---
name: plan-update
description: Publica en main un cambio de plan.md (tomar una tarea, terminarla, bloquearte, o anotar algo en tu Bitácora) sin salir de tu rama ni tocar tu working tree. Úsala SIEMPRE que vayas a modificar plan.md; nunca lo edites directamente en tu rama. También sirve para leer el plan vigente.
argument-hint: "<ws 0-5> <tarea, ej. S1> <progreso|integrar|hecho|bloqueado> [nota]"
allowed-tools: Bash(scripts/plan.sh:*), Bash(date:*), Read, Edit
---

# /plan-update — actualizar plan.md sin romperle nada a nadie

Argumentos: `$ARGUMENTS`

`plan.md` vive en `main` y lo editan 6 agentes a la vez. Por eso **no se edita en tu rama**: se edita en un worktree aparte que el script mantiene en `.worktrees/plan/`, y el script valida que solo tocaste **tu** sección antes de publicar.

## Pasos

1. `scripts/plan.sh begin` → imprime la ruta del archivo a editar (`…/.worktrees/plan/plan.md`). **Edita ESE archivo**, no `./plan.md`.
2. Edita **solo tu sección** (`### WS-<n> · …`):
   - El icono de la tarea: ⬜ no iniciado → 🟦 en progreso → 🟨 por integrar (terminada en tu rama) → ✅ hecho (en `main` y verificada) · 🟥 bloqueado.
   - La cabecera del workstream:
     - `Estado`: 🟦 En progreso al tomar tu primera tarea · 🟥 Bloqueado si no puedes avanzar · ✅ Hecho cuando todas tus tareas estén ✅.
     - `Agente activo`: quién trabaja (ej. `Claude de Sebas`), o `—` si lo sueltas.
     - `Trabajando ahora en`: el ID y título corto de la tarea, o `—`.
     - `Última actualización`: la salida de `date "+%Y-%m-%d %H:%M"`.
   - La **Bitácora** (solo agregar líneas, con la hora): bloqueos y su causa, `SOLICITUD → WS-N: …` para pedirle algo a otro workstream, y cualquier dato que otros necesiten (p. ej. Elías: posiciones congeladas en M1).
3. `scripts/plan.sh publish <ws> "<tarea> <estado>"` — ej.: `scripts/plan.sh publish 3 "S1 en progreso"`.
   - Si lo **rechaza por tocar fuera de tu sección**: deshaz esas líneas (te las muestra) y repite el paso 3. Lo que quieras cambiar de otro se pide por Bitácora, no se edita.
   - Si reporta **conflicto**: tu cambio quedó en `.worktrees/plan-rechazado.patch`; repite desde el paso 1.
   - Para descartar una edición a medias: `scripts/plan.sh abort`.

## Solo leer

- Tu sección vigente: `scripts/plan.sh show <ws>` · El plan completo: `scripts/plan.sh show`
- Tablero de fases y de los 6 workstreams: `scripts/plan.sh board`

## Cuándo se actualiza

Al **tomar** una tarea, al **terminarla**, y al **bloquearte**. No publiques por cada detalle: son 3 momentos por tarea.
