# Deuda_Tecnica.md — Lab Operador

> **Registro único de deuda técnica del proyecto.** Todo atajo que tomemos hoy por el tiempo se anota aquí, para que el demo salga rápido **sin** que nadie olvide lo que quedó pendiente.
> Reglas completas en `plan.md` §0.7. Resumen abajo. **Para registrar usa la skill `/deuda`** (o `scripts/deuda.sh add …`): pone el ID y el formato por ti.

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
- **DT-0-08** · 🟡 Media · ⬜ Abierta — Stubs de módulos en las carpetas de otros workstreams
  - **Dónde:** frontend/src/{dashboard,lab,motion,status}/index.ts y backend/app/{bus,agent}/routes.py
  - **Por qué se dejó:** hacen falta para que todo compile e importe desde el día 1
  - **Riesgo:** si alguien no los reemplaza, el demo corre con lógica falsa que parece real
  - **Cómo se paga:** cada dueño los sustituye por su implementación conservando la firma; al integrar M2 no debe quedar ninguno
- **DT-0-09** · 🟢 Baja · ⬜ Abierta — SECRET_KEY con valor por defecto inseguro
  - **Dónde:** backend/app/config.py
  - **Por qué se dejó:** para que arranque en local sin configurar nada
  - **Riesgo:** si se despliega sin .env, las cookies de sesión son falsificables
  - **Cómo se paga:** generar una en el VPS con openssl rand -hex 32 (ya está en .env.example)
- **DT-0-10** · 🟡 Media · ⬜ Abierta — El fix de temperature para Sonnet vive en operator.py, archivo de WS-5
  - **Dónde:** backend/app/agent/operator.py (make_model, constante NO_TEMPERATURE)
  - **Por qué se dejó:** Sonnet 5 y Opus 5 devuelven 400 invalid_request_error 'temperature is deprecated for this model' y el agente caia siempre al plan B; el arreglo tocaba un archivo de Adrian y se aplico desde WS-0 para no bloquear la prueba con Sonnet
  - **Riesgo:** Si Adrian edita make_model en ws/5-agente habra conflicto en la integracion M2; y la lista de familias sin temperature es una lista a mano que hay que mantener
  - **Cómo se paga:** Avisar a Adrian en la Bitacora WS-0: o lo adopta en su rama, o se resuelve en P10 tomando esta version
- **DT-0-11** · 🟢 Baja · ⬜ Abierta — El contrato no fijaba la unidad de ts y el cliente la normaliza a mano
  - **Dónde:** frontend/src/net/bus.ts (normalizarTs)
  - **Por qué se dejó:** plan.md 5.2 dice 'ts: number' sin unidad: el bus de WS-4 manda segundos (time.time()) y el mock de WS-0 milisegundos (Date.now()), asi que el chat del dashboard pintaba horas de enero de 1970 y todas las lineas de un job salian con la misma hora. Se normaliza en el cliente para no tocar archivos de WS-4 ni de WS-1 a mitad de la jornada
  - **Riesgo:** La heuristica (ts < 1e12 = segundos) es correcta hasta el ano 2286, pero esconde la divergencia: si manana alguien consume ts sin pasar por bus.ts vuelve el bug
  - **Cómo se paga:** Fijar en 5.2 que ts es epoch en milisegundos y que el bus mande time.time()*1000; despues quitar normalizarTs
- **DT-0-12** · 🟢 Baja · ⬜ Abierta — main.ts sondea motion.isBusy cada 150 ms para no perder el job en cola
  - **Dónde:** frontend/src/main.ts (lanzarPendientes)
  - **Por qué se dejó:** Con D-10 el servidor activa el siguiente job en t=24 s exactos y la coreografia local va unos ms detras, asi que motion.imprimir devolvia false y la segunda pieza no se animaba nunca (reproducido en vivo: '[main] coreografia ignorada'). El contrato Motion (5.6) no avisa cuando termina, asi que se reintenta hasta que acepte
  - **Riesgo:** Si una coreografia se cuelga, los jobs se quedan esperando en el navegador (el servidor sigue bien); un timer vivo mientras haya pendientes
  - **Cómo se paga:** Agregar onIdle(cb) a Motion en 5.6 cuando WS-3 entregue, y cambiar el sondeo por esa suscripcion

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

- **DT-4-01** · 🟡 Media · ⬜ Abierta — timeline.py no cancela su tarea asyncio si se resetea a medio job
  - **Dónde:** backend/app/bus/timeline.py::_run
  - **Por qué se dejó:** F1-F5 se priorizó cerrar rápido el camino feliz para M2; cancelar tasks por job es más código
  - **Riesgo:** Reiniciar mientras un job anima puede dejar una tarea vieja escribiendo estado (printer/arm) sobre el lab recién reseteado
  - **Cómo se paga:** trackear el asyncio.Task devuelto por create_task en un dict por job.id y cancelarlo desde bus.reset()

---

## WS-5 · Operador (agente) — Adrián

- **DT-5-01** · 🟡 Media · ⬜ Abierta — /api/agent/health usa la llave congelada 'ollama' para decir si responde Anthropic
  - **Dónde:** backend/app/agent/routes.py::agent_health
  - **Por qué se dejó:** El contrato §5.3 está congelado y el agente cambió de Ollama a Anthropic Haiku; renombrar la llave hoy rompería al frontend
  - **Riesgo:** Quien lea el JSON puede pensar que hay un Ollama detrás; confunde a quien depure el demo
  - **Cómo se paga:** WS-0 renombra la llave a 'llm' en la integración y el frontend deja de leer 'ollama'; ya se agregó el campo aditivo provider
- **DT-5-02** · 🟢 Baja · ⬜ Abierta — El warm-up del agente se engancha con router.on_event('startup'), API deprecada de FastAPI
  - **Dónde:** backend/app/agent/routes.py::_on_startup
  - **Por qué se dejó:** El lifespan moderno vive en main.py, que es de WS-0 y no puedo editar (§4.3)
  - **Riesgo:** FastAPI puede quitar on_event en una versión futura y el warm-up dejaría de correr en silencio; el demo pagaría la primera llamada
  - **Cómo se paga:** WS-0 expone un lifespan en main.py y el router registra ahí su warm-up
- **DT-5-03** · 🟡 Media · ⬜ Abierta — Los tests del agente contra el modelo real no corren en la suite por defecto
  - **Dónde:** backend/tests/test_agent_llm.py
  - **Por qué se dejó:** Cada corrida cuesta llamadas a la API y necesita red; el resto de la suite debe correr offline y rápido en cada /ws-merge
  - **Riesgo:** Una regresión de prompt (que el modelo deje de llamar la tool) no la detecta pytest: solo se ve corriendo A5 a mano
  - **Cómo se paga:** Correrlos con RUN_LLM_TESTS=1 antes de cada deploy, y en CI con un presupuesto de llamadas
- **DT-5-04** · 🟡 Media · ⬜ Abierta — La configuración del agente (ANTHROPIC_API_KEY, ANTHROPIC_MODEL) se lee fuera de config.py
  - **Dónde:** backend/app/agent/operator.py::model_id y api_key
  - **Por qué se dejó:** config.py es de WS-0 (§4.3) y el cambio a Anthropic salió después de M0; no quise tocar su archivo a media jornada
  - **Riesgo:** Las variables del proyecto quedan en dos lugares: nadie encuentra la del agente leyendo config.py, y .env.example no las lista todavía
  - **Cómo se paga:** WS-0 mueve ambas a Settings en config.py y las agrega a .env.example y al compose (ya pedido en la Bitácora WS-5)
- **DT-5-05** · 🟢 Baja · ⬜ Abierta — El candado de una orden a la vez es un asyncio.Lock en memoria
  - **Dónde:** backend/app/agent/routes.py::_lock
  - **Por qué se dejó:** Es lo que pide D-15 y basta con un worker, igual que el bus (DT-0-01)
  - **Riesgo:** Con más de un worker o más de una instancia, dos personas podrían lanzar órdenes en paralelo y el 429 dejaría de proteger
  - **Cómo se paga:** Mover el candado al mismo lugar donde se persista el estado del lab cuando se pague DT-0-01
