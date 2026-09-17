# Instrucciones para agentes

Este repo lo construyen 6 personas en paralelo, cada una con su propio agente, en un solo día.

1. **Lee `plan.md` antes de tocar nada**, en especial §0 (protocolo), §4.3 (qué archivos son tuyos) y §5 (contratos congelados).
2. **Arranca con `/ws-start N`** (N = tu workstream). No crees ramas a mano.
3. **Nunca edites `plan.md` en tu rama**: usa `/plan-update`. El plan vigente es el de `origin/main` (`scripts/plan.sh show`).
4. **Trabaja solo en tu carpeta.** Los contratos de §5 no se modifican: si necesitas un cambio, pídelo en tu Bitácora con `SOLICITUD → WS-0:`.
5. **Registra todo atajo con `/deuda`**, y marca el código con el ID: `// TODO(DT-3-02): …`. Cero TODO sin ID.
6. **Integra con `/ws-merge N`.** Nunca hagas push a `main` a mano.
7. Responde en español.
