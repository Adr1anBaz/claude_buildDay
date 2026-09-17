---
name: ws-start
description: Arranca o retoma el trabajo de un workstream del Lab Operador. Úsala al entrar al repo por primera vez, al empezar una sesión nueva, o cuando el usuario diga quién es o qué workstream le toca (José Luis 0, Daniela 1, Elías 2, Sebas 3, Fernando 4, Adrián 5). Crea la rama correcta solo cuando M0 ya está en main y muestra la sección vigente del plan.
argument-hint: "<ws 0-5>"
allowed-tools: Bash(scripts/ws.sh:*), Bash(scripts/plan.sh:*), Read
---

# /ws-start — arrancar o retomar un workstream

Workstream: `$ARGUMENTS` (0 José Luis · 1 Daniela · 2 Elías · 3 Sebas · 4 Fernando · 5 Adrián). Si viene vacío, pregunta al usuario quién es antes de seguir.

1. Corre `scripts/ws.sh start <ws>`.
   - Si responde **"⏳ M0 todavía no está"**: NO crees rama ni escribas código del repo. Haz solo el bloque **"Mientras esperas M0"** de la sección que imprimió, y dile al usuario que vuelva a correr `/ws-start` cuando WS-0 avise.
   - Si crea o retoma la rama: continúa.
2. Lee lo que imprimió: es **tu sección vigente** de `plan.md`, leída de `origin/main`. El `plan.md` de tu rama puede estar viejo, no te fíes de él. Para ver a los demás: `scripts/plan.sh board`.
3. Si es tu primera vez, lee también de `plan.md`: §0 (protocolo), §4.3 (qué archivos son tuyos) y §5 (contratos congelados).
4. Elige la **primera tarea ⬜ o 🟦** de tu sección y márcala en progreso con `/plan-update` **antes** de escribir código.
5. Trabaja solo en tus carpetas. No modifiques los contratos de §5: si necesitas un cambio, anótalo en tu Bitácora como `SOLICITUD → WS-0: …` usando `/plan-update`.

Las otras skills del proyecto: `/plan-update` (cambiar estado en el plan), `/deuda` (registrar un atajo), `/ws-merge` (integrar a main).
