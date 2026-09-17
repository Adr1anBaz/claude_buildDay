---
name: ws-merge
description: Integra la rama de tu workstream a main de forma segura. Úsala cuando una tarea está terminada y desbloquea a otros, o en los puntos de integración M1, M2 y M3 de plan.md. Trae main a tu rama, corre typecheck y tests, verifica que solo tocaste tus archivos y publica a main en fast-forward. Nunca hagas merge ni push a main a mano.
argument-hint: "<ws 0-5>"
allowed-tools: Bash(scripts/ws.sh:*), Bash(scripts/deuda.sh:*), Bash(scripts/plan.sh:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*), Read, Edit
---

# /ws-merge — integrar a main sin romper a los otros 5

Workstream: `$ARGUMENTS`

Un push malo a `main` frena a todo el equipo. Por eso la integración pasa siempre por el script.

1. Deja tu rama limpia: todo con commit (`git status` sin cambios).
2. `scripts/deuda.sh orphans` → debe salir vacío. Si no, registra esos TODO con `/deuda` o bórralos.
3. `scripts/ws.sh merge <ws>`. El script:
   - trae `origin/main` a tu rama. Si hay **conflicto**: resuélvelo tocando **solo tus archivos**, haz commit y repite. Si el conflicto está en un archivo de otro, quédate con la versión de `main` y avisa al dueño;
   - corre `npm run typecheck` y `uv run pytest`. Si fallan, **se arregla, no se salta**;
   - verifica la propiedad de archivos (`plan.md` §4.3). Si te marca archivos ajenos: saca esos cambios de tu rama y pídeselos al dueño por Bitácora. Si `plan.md` aparece como modificado, restáuralo: `git checkout origin/main -- plan.md` y haz commit;
   - publica a `main` en fast-forward y reintenta solo si `main` se movió mientras tanto.
4. Con el merge hecho, usa `/plan-update` para pasar tus tareas de 🟨 a ✅, y avisa al equipo si desbloqueas a alguien (M1: Elías → Sebas, Fernando → Adrián).

**Emergencias** (solo con el visto bueno de WS-0, y siempre registradas con `/deuda`):
`SKIP_CHECKS=1 scripts/ws.sh merge <ws>` salta typecheck y tests · `ALLOW_OUTSIDE=1 scripts/ws.sh merge <ws>` permite archivos ajenos.
