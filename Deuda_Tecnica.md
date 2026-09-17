# Deuda_Tecnica.md — Lab Operador

> **Registro único de deuda técnica del proyecto.** Todo atajo que tomemos hoy por el tiempo se anota aquí, para que el demo salga rápido **sin** que nadie olvide lo que quedó pendiente.
> Reglas completas en `plan.md` §0.7. Resumen abajo.

## Reglas

1. **Qué es deuda:** cualquier cosa que hiciste "así por ahora": valores hardcodeados, errores sin manejar, falta de tests, stubs o mocks que se quedaron, workarounds, copiar-pegar, límites conocidos, temas de seguridad, decisiones "por defecto" que habría que revisar.
2. **Qué NO es deuda:** los *no-objetivos* del proyecto (`plan.md` §2) ni lo que el PDF dice explícitamente que no se hace. Eso es alcance, no deuda.
3. **Cero `TODO` huérfanos:** todo `TODO` / `FIXME` / `HACK` en el código lleva un ID de este documento: `// TODO(DT-3-02): …`. Si no vale la pena anotarlo aquí, no vale la pena dejar el TODO.
4. **Solo editas la sección de TU workstream.** Los IDs llevan tu número (`DT-<ws>-<nn>`), así nunca chocan.
5. **Se anota en el mismo commit que crea la deuda**, en tu rama. Llega a `main` con tu merge (a diferencia de `plan.md`, no necesita publicarse al instante).
6. **Pagar una deuda:** cambia su estado a ✅ Pagada y anota el commit. **No borres la entrada.**
7. Una deuda 🔴 que pueda romper el demo se avisa además a WS-0 en el momento.

**Severidad:** 🔴 Alta — puede romper el demo, perder datos o es de seguridad · 🟡 Media — limita o molesta, hay que pagarla si el proyecto sigue · 🟢 Baja — cosmética o de limpieza.
**Estado:** ⬜ Abierta · ✅ Pagada · 🚫 Descartada (con razón).

### Formato de una entrada

```markdown
- **DT-X-NN** · 🟡 Media · ⬜ Abierta — Título corto de la deuda.
  - **Dónde:** `ruta/al/archivo.py` (función o línea)
  - **Por qué se dejó:** la razón real (casi siempre: tiempo).
  - **Riesgo:** qué puede pasar si no se paga.
  - **Cómo se paga:** el arreglo correcto, en una o dos líneas.
```

### Ver todo lo abierto

```bash
grep -nE '^- \*\*DT-[0-9].*⬜' Deuda_Tecnica.md          # todas las abiertas
grep -nE '^- \*\*DT-[0-9].*🔴.*⬜' Deuda_Tecnica.md      # solo las que pueden romper el demo
grep -rnE 'TODO|FIXME|HACK' frontend/src backend/app | grep -v 'DT-'   # TODOs huérfanos (debe salir vacío)
```

---

## WS-0 · Plataforma — José Luis

*Deuda aceptada desde el plan (nace de las decisiones de `plan.md` §3):*

- **DT-0-01** · 🟡 Media · ⬜ Abierta — El estado del lab vive solo en memoria y en un único proceso.
  - **Dónde:** arquitectura (D-04); `backend/app/bus/service.py`, Dockerfile con 1 worker.
  - **Por qué se dejó:** es lo más rápido y suficiente para un demo.
  - **Riesgo:** reiniciar el contenedor borra el lab; no escala a más de un worker ni a más de una instancia.
  - **Cómo se paga:** persistir el estado (SQLite o Redis) y publicar eventos por un canal compartido.
- **DT-0-02** · 🟡 Media · ⬜ Abierta — Un solo lab global compartido por todos los visitantes.
  - **Dónde:** arquitectura (D-04, D-09).
  - **Por qué se dejó:** modela "un lab real" y evita manejar sesiones hoy.
  - **Riesgo:** cualquiera con la contraseña puede llenar cajones o reiniciar a media demo.
  - **Cómo se paga:** labs por sesión/sala, o roles (operador vs. espectador).
- **DT-0-03** · 🟡 Media · ⬜ Abierta — Autenticación por contraseña única compartida.
  - **Dónde:** `backend/app/auth.py` (D-09).
  - **Por qué se dejó:** no hay proxy propio ni tiempo para usuarios.
  - **Riesgo:** sin usuarios, sin revocación individual, sin límite de intentos ni de peticiones al agente.
  - **Cómo se paga:** Cloudflare Access delante del hostname, o login real + rate-limit en `/api/chat`.
- **DT-0-04** · 🔴 Alta · ⬜ Abierta — El agente depende de una laptop encendida (Ollama en la Mac vía Tailscale).
  - **Dónde:** infraestructura (D-06); `OLLAMA_BASE_URL`.
  - **Por qué se dejó:** el VPS no puede correr el modelo (8 GB, sin GPU, servidor compartido).
  - **Riesgo:** si la Mac duerme, cambia de red o se cierra, el operador deja de responder. **Mitigado para el demo con el botón Demo (plan B)**, pero no resuelto.
  - **Cómo se paga:** servir el modelo en una máquina siempre encendida con GPU, o usar un proveedor de API.
- **DT-0-05** · 🟡 Media · ⬜ Abierta — Deploy manual por `rsync`, sin CI/CD, sin rollback ni versionado de imágenes.
  - **Dónde:** `scripts/deploy.sh` (D-19).
  - **Por qué se dejó:** no somos admin del repo (no hay secrets ni deploy keys) y el VPS no se toca.
  - **Riesgo:** un deploy malo a minutos del demo no tiene vuelta atrás rápida; se despliega lo que haya en la laptop, no necesariamente `main`.
  - **Cómo se paga:** pipeline que construya la imagen etiquetada por commit y despliegue desde `main`.
- **DT-0-06** · 🟡 Media · ⬜ Abierta — Contratos duplicados a mano en TypeScript y en Python.
  - **Dónde:** `frontend/src/contracts.ts` y `backend/app/contracts.py`.
  - **Por qué se dejó:** generar tipos automáticamente cuesta más que mantener dos archivos por un día.
  - **Riesgo:** que se desincronicen y falle en ejecución algo que compila.
  - **Cómo se paga:** generar los tipos TS desde el OpenAPI/Pydantic del backend.
- **DT-0-07** · 🟡 Media · ⬜ Abierta — Sin pruebas de punta a punta automatizadas; la aceptación es manual.
  - **Dónde:** `plan.md` §9 (guion del demo).
  - **Por qué se dejó:** tiempo.
  - **Riesgo:** regresiones de integración que solo se ven al ensayar.
  - **Cómo se paga:** una prueba Playwright que corra el guion con `TIMELINE_SCALE` bajo.

---

## WS-1 · Dashboard — Daniela

- _(sin deuda registrada)_

---

## WS-2 · Lab 3D — Elías

- _(sin deuda registrada)_

---

## WS-3 · Movimiento — Sebas

- _(sin deuda registrada)_

---

## WS-4 · Estado y plan B — Fernando

- _(sin deuda registrada)_

---

## WS-5 · Operador (agente) — Adrián

- _(sin deuda registrada)_
