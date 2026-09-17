# plan.md — Lab Operador · Claude Build Day (Ibero)

> **Documento vivo y única fuente de verdad**: qué se construye, quién lo construye y en qué va.
> **Si eres un agente que acaba de entrar al repo:** lee §0 y §1, y ve directo a tu workstream en §7.
> Creado: 2026-09-17 · Demo: **hoy mismo** · Equipo: 6 personas, cada una con su propio agente.

---

## 0. Protocolo para agentes (léelo antes de tocar nada)

### 0.1 Estados

| Icono | Estado | Significado |
|---|---|---|
| ⬜ | No iniciado | Nadie lo ha tomado |
| 🟦 | En progreso | Alguien lo está haciendo **ahora** |
| 🟨 | Por integrar | Terminado en su rama, falta merge a `main` |
| ✅ | Hecho | En `main` y verificado con su "Hecho cuando" |
| 🟥 | Bloqueado | No puede avanzar; la razón va en la Bitácora del workstream |

### 0.2 Reglas de edición de este archivo

1. **Solo editas la sección de TU workstream** (§7, tu `WS-N`). Nunca la de otro. Así no hay conflictos de merge.
2. El **Tablero de fases** (§1) y los **Contratos** (§5) solo los edita **WS-0 (José Luis)**.
3. ¿Necesitas un cambio de contrato o algo de otro workstream? Escríbelo en **tu** Bitácora con el prefijo `SOLICITUD → WS-N:` y avisa a la persona. No lo cambies tú.
4. Actualizas el plan **con `/plan-update`** en **3 momentos**: al tomar una tarea (⬜→🟦), al terminarla (🟦→🟨/✅), y al bloquearte (→🟥).
5. Cada actualización toca: el icono de la tarea **y** la cabecera del workstream (`Estado`, `Trabajando ahora en`, `Última actualización`).

### 0.3 Skills del proyecto (úsalas: no hagas estos pasos a mano)

Viven en `.claude/skills/` y te llegan con `git pull`. Cada una se apoya en un script de `scripts/` que hace la parte delicada de git de forma determinista.

| Skill | Cuándo | Qué hace por ti |
|---|---|---|
| **`/ws-start <ws>`** | Al entrar al repo o empezar sesión | Crea o retoma tu rama con el nombre correcto **solo si M0 ya está en `main`**, e imprime tu sección vigente del plan |
| **`/plan-update <ws> <tarea> <estado>`** | Al tomar, terminar o bloquear una tarea | Edita `plan.md` en un **worktree aparte** y lo publica en `main`: no cambia tu rama ni tu working tree, y **rechaza** el cambio si tocaste la sección de otro |
| **`/deuda <ws> <sev> …`** | Cada vez que tomes un atajo | Registra la entrada con el siguiente ID y el formato correcto; también marca pagadas y detecta `TODO` huérfanos |
| **`/ws-merge <ws>`** | Tarea terminada que desbloquea a otro, o puntos M1/M2/M3 | Trae `main` a tu rama, corre typecheck y tests, verifica que **solo tocaste tus archivos** (§4.3) y publica a `main` en fast-forward |

Sin skills (o para leer): `scripts/plan.sh board` · `scripts/plan.sh show <ws>` · `scripts/deuda.sh list` · cada script imprime su ayuda si lo corres sin argumentos.

⚠️ **El `plan.md` de tu rama puede estar viejo.** El plan vigente es siempre el de `origin/main`: léelo con `scripts/plan.sh show`. **Nunca edites `plan.md` en tu rama** (`/ws-merge` lo rechaza).

### 0.4 Flujo de git

- Una rama por persona: `ws/0-plataforma`, `ws/1-dashboard`, `ws/2-lab`, `ws/3-motion`, `ws/4-estado`, `ws/5-agente`. **Todas nacen de `main` después de M0** (las crea `/ws-start`).
- Cada módulo vive en **su carpeta** (§4.3). No edites archivos fuera de tu carpeta.
- A `main` se llega **solo con `/ws-merge`**, sin PR formal, en los puntos de integración (§6) o antes si tu tarea desbloquea a otro. Nada de `git push origin main` a mano.
- Commits pequeños, mensaje `ws-N: qué hiciste`.

### 0.5 Ver el tablero de todos los workstreams

```bash
scripts/plan.sh board
```

### 0.6 Prompt de arranque (pégalo en tu Claude)

> Haz `git pull` y corre **`/ws-start N`**. Soy **<Nombre>** y mi workstream es **WS-N**. Sigue el protocolo de `plan.md` §0: marca mi primera tarea no iniciada con `/plan-update` antes de escribir código, trabaja en mi rama y en mi carpeta, respeta los contratos de §5 sin modificarlos, registra con `/deuda` cualquier atajo que tomes, e integra con `/ws-merge`. Usa subagentes donde mi sección diga que las tareas son paralelizables.

### 0.7 Deuda técnica → `Deuda_Tecnica.md`

Hoy vamos a tomar atajos a propósito. La regla es que **ninguno se quede solo en la cabeza de alguien**:

0. **Usa la skill `/deuda`** (o `scripts/deuda.sh`): pone el ID y el formato por ti.
1. Todo atajo ("así por ahora", hardcode, error sin manejar, test que falta, stub que se quedó, workaround, límite conocido, tema de seguridad) se anota en **`Deuda_Tecnica.md`**, en **la sección de tu workstream**, con ID `DT-<ws>-<nn>` y el formato que viene en ese archivo.
2. **Cero `TODO` huérfanos:** todo `TODO` / `FIXME` / `HACK` en el código lleva su ID: `// TODO(DT-3-02): …`.
3. Se anota **en el mismo commit que crea la deuda**, en tu rama; llega a `main` con tu `/ws-merge` (no usa `/plan-update`).
4. Los *no-objetivos* de §2 **no** son deuda: son alcance.
5. Una deuda 🔴 que pueda romper el demo se avisa además a WS-0 en el momento.
6. Pagarla = marcarla ✅ con el commit; nunca se borra la entrada.

---

## 1. Tablero de fases  *(solo edita WS-0)*

| Fase | Qué | Ventana | Estado | Sale con |
|---|---|---|---|---|
| **0** | Cimientos: esqueleto, contratos en código, mocks | T+0:00 → T+0:45 | ⬜ | **M0**: `main` corre en local con mock |
| **1** | Módulos en paralelo (6 workstreams) | T+0:45 → T+2:45 | ⬜ | **M1** (T+1:15) escena gris + bus core · **M2** módulos completos |
| **2** | Integración en `main` | T+2:45 → T+3:30 | ⬜ | **M3**: camino feliz de punta a punta en local |
| **3** | Deploy final + ensayo del demo y del plan B | T+3:30 → T+4:15 | ⬜ | **M4**: URL pública funcionando |
| **4** | Pulido (solo si sobra tiempo) | resto | ⬜ | — |

**T+0:00 =** _(WS-0: anota aquí la hora real de arranque)_

> Regla de oro de hoy: **primero el plan B, después el agente.** Si a T+3:30 el agente no es confiable, se presenta con el botón Demo y nadie toca nada más.

---

## 2. Qué construimos

Un laboratorio de impresión 3D **simulado** que se opera sin tocar las máquinas: subes el `.stl`, dices para qué es, y un agente arma la orden, elige la impresora libre y lanza el trabajo; en pantalla se ve imprimir, un brazo recoge la pieza y la guarda en un cajón. Se entiende en dos minutos. **No es un chatbot ni un diseñador: es un operador de lab.**

**Flujo de punta a punta**

1. Dashboard: adjuntas `base-dron.stl` (se ve en el visor) y escribes "4 motores, 250 mm" → Enviar.
2. `POST /api/chat` → el agente llama `get_lab_status` → elige impresora y preset → llama `send_to_printer`.
3. El bus valida, **reserva el primer cajón libre**, marca la impresora `Imprimiendo` y emite `job_started`.
4. El navegador recibe `job_started` → `imprimir('P1','cajon-1')` → coreografía de 24 s. En paralelo el bus avanza el estado en el servidor con los mismos tiempos y escribe las líneas del chat.
5. A los 24 s: cajón ocupado, brazo en reposo, todo quieto.

**No-objetivos (no se hace, aunque sobre tiempo):** medir/slicear el STL, IK, física, caminar en primera persona, lab embebido en el dashboard, tercera columna, página de settings, animaciones idle, que el agente diseñe piezas o mueva el brazo.

---

## 3. Decisiones cerradas

| ID | Decisión | Origen |
|---|---|---|
| D-01 | 6 workstreams, una persona + un agente cada uno. José Luis = **WS-0 Plataforma** (esqueleto, contratos, deploy, integración). | Usuario |
| D-02 | Demo **hoy**: camino feliz y plan B primero; nada de pulido hasta Fase 4. | Usuario |
| D-03 | Frontend: **Vite + TypeScript + Three.js, sin framework**. Una sola página, dos vistas (`#dashboard-root`, `#lab-root`). | Usuario |
| D-04 | Backend: **FastAPI (Python 3.12, `uv`)**. El bus vive **en memoria en el servidor**; todo cambio se empuja por **WebSocket**. ⚠️ **Un solo worker de uvicorn** (el estado no se comparte entre procesos). | Usuario |
| D-05 | El **servidor es dueño del tiempo**: marca 0/10/14/20/24 s. El navegador solo anima. El agente nunca ve un estado falso. | Derivada de D-04 |
| D-06 | LLM: **Strands + Ollama `qwen3:8b`** corriendo en la **Mac M2 Pro de José Luis**; el VPS lo alcanza por **Tailscale** (`http://100.121.126.125:11434`). El VPS **no** corre modelos. | Usuario |
| D-07 | Deploy: **Docker Compose** en `imperioonserver`, **un solo contenedor**, **puerto configurable** por `.env`. Sin Caddy: sale por el **Cloudflare Tunnel que ya existe**. Dominio: subdominio de `imperioon.com` (propuesto: `lab.imperioon.com`). | Usuario |
| D-08 | **El VPS no se toca**: nada de instalar paquetes, firewall ni otros contenedores. Huella total: 1 carpeta, 1 proyecto compose, 1 puerto en `127.0.0.1`, 1 hostname nuevo en el túnel. Con límites de RAM/CPU en el compose. | Usuario |
| D-09 | Acceso: **contraseña única compartida**, implementada **en la app** (cookie firmada), porque no hay Caddy. Sin `LAB_PASSWORD` → auth apagada (dev local). | Usuario + derivada |
| D-10 | **2ª orden con P1 ocupada → se acepta y hace cola.** P2 pasa a `Imprimiendo` de inmediato; su coreografía arranca cuando termina la activa. Sebas anima siempre **una a la vez**. | Usuario |
| D-11 | **Cajón se reserva al lanzar** (primer libre 1→4), no al guardar. 4 llenos → `send_to_printer` **rechaza** con `sin cajón`. Botón **Reiniciar** en la franja vacía el lab para repetir el demo. | Usuario |
| D-12 | Git: rama por persona + merge a `main` sin PR formal (§0.4). | Usuario |
| D-13 | El STL **no se sube**: se visualiza en el navegador y al servidor solo viaja `file.name`. | Por defecto |
| D-14 | **Todo lo que aparece en el chat viene del bus** (evento `chat`), salvo el mensaje propio del usuario. Así Demo y agente se ven idénticos y todos los navegadores coinciden. | Por defecto |
| D-15 | El agente es **sin memoria entre órdenes** (cada mensaje = una orden nueva) y atiende **una orden a la vez**. | Por defecto |
| D-16 | `pieza` es una **plantilla invisible**; cada job la **clona**, para que las piezas anteriores sigan en sus cajones. | Por defecto |
| D-17 | **Simular**: si hay bus conectado llama `POST /api/demo`; si no (mock/offline) corre `imprimir('P1','cajon-1')` local. Es el último plan B si el backend muere. | Por defecto |
| D-18 | El brazo se anima en **espacio de articulaciones** (poses puestas a mano), no con puntos cartesianos: son **7 poses**, no 32 puntos (§7 WS-3). | Por defecto |
| D-19 | Deploy por **`rsync` + build en el VPS**: no se ponen credenciales de GitHub en el servidor (el repo es de Adrián y no somos admin). | Por defecto |
| D-20 | Toda la deuda técnica se registra en **`Deuda_Tecnica.md`** (una sección por workstream, IDs `DT-<ws>-<nn>`, cero `TODO` huérfanos). Reglas en §0.7. | Usuario |
| D-21 | **Micro-skills del proyecto** en `.claude/skills/` (`/ws-start`, `/plan-update`, `/deuda`, `/ws-merge`) respaldadas por scripts en `scripts/`. `plan.md` se publica desde un worktree aparte y `main` solo recibe fast-forwards verificados. Reglas en §0.3. | Usuario |

*"Por defecto" = lo decidió el plan para no frenar; si alguien no está de acuerdo, se discute con WS-0, no se cambia por la libre.*

---

## 4. Arquitectura

### 4.1 Diagrama

```
Navegador ──HTTPS──▶ Cloudflare ──Tunnel (ya existe)──▶ VPS imperioonserver (8 GB, NO se toca)
                                                        └─ docker compose: lab-operador
                                                             FastAPI :8000  ◀── 127.0.0.1:${APP_PORT}
                                                             ├─ sirve frontend/dist (estático)
                                                             ├─ /api/*  y  /ws     ← bus en memoria (1 worker)
                                                             └─ agente Strands ──Tailscale──▶ Mac M2 Pro
                                                                                              Ollama :11434 · qwen3:8b
```

### 4.2 Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite, TypeScript estricto, Three.js (`STLLoader`, `OrbitControls`), CSS plano |
| Backend | Python 3.12 (`uv`), FastAPI, uvicorn (1 worker), Pydantic v2, pytest + httpx |
| Agente | `strands-agents[ollama]`, Ollama `qwen3:8b` (fallback `qwen3:4b`), temperatura 0, *thinking* apagado |
| Infra | Docker multi-stage (node build → python runtime), Docker Compose, Cloudflare Tunnel, Tailscale |

### 4.3 Estructura del repo y **propiedad de archivos**

```
plan.md · README.md · CLAUDE.md · .env.example · Dockerfile · docker-compose.yml · scripts/   → WS-0
.claude/skills/ · .gitignore                                     → WS-0
Deuda_Tecnica.md                                                → TODOS, cada quien SOLO su sección (§0.7)
backend/
  pyproject.toml · app/main.py · app/config.py · app/auth.py · app/contracts.py               → WS-0
  app/bus/      service.py · timeline.py · routes.py (state, demo, reset, /ws)                → WS-4 Fernando
  app/agent/    tools.py · operator.py · routes.py (/api/chat)                                → WS-5 Adrián
  tests/        test_bus_*.py → WS-4 · test_agent_*.py → WS-5
frontend/
  index.html · package.json · vite.config.ts · tsconfig.json                                  → WS-0
  src/main.ts · src/views.ts · src/contracts.ts · src/net/ (api.ts, bus.ts, mock.ts)          → WS-0
  src/dashboard/   → WS-1 Daniela          src/lab/     → WS-2 Elías
  src/motion/      → WS-3 Sebas            src/status/  → WS-4 Fernando
  public/samples/base-dron.stl             → WS-1 Daniela
```

Regla: **si el archivo no está en tu fila, no lo editas.** Dependencias nuevas (`package.json` / `pyproject.toml`): Fase 0 deja instalado todo lo previsto; si necesitas otra, agrégala y anótalo en tu Bitácora.

### 4.4 Correr en local

```bash
cd backend  && uv sync && uv run uvicorn app.main:app --reload --port 8000   # 1 worker
cd frontend && npm install && npm run dev        # Vite con proxy /api y /ws → :8000
# Sin backend:  http://localhost:5173/?mock=1    # bus simulado, 24 s de job falso
```

---

## 5. Contratos  *(CONGELADOS — solo WS-0 los cambia; viven también en `contracts.ts` / `contracts.py`)*

### 5.1 Tipos

```ts
type PrinterId = 'P1' | 'P2';
type DrawerId  = 'cajon-1' | 'cajon-2' | 'cajon-3' | 'cajon-4';
type Preset    = 'fino' | 'normal' | 'estructural';
type PrinterStatus = 'Libre' | 'Imprimiendo' | 'Lista';
type ArmStatus     = 'Reposo' | 'En camino' | 'Con pieza';
type JobPhase = 'en_cola' | 'imprimiendo' | 'recogiendo' | 'guardando' | 'cerrando';

interface DrawerState { status: 'Libre' | 'Reservado' | 'Ocupado'; file: string | null }
interface Job { id: string; file: string; preset: Preset; printer: PrinterId; drawer: DrawerId; phase: JobPhase }
interface LabState {
  printers: Record<PrinterId, PrinterStatus>;
  arm: ArmStatus;
  drawers: Record<DrawerId, DrawerState>;
  job: Job | null;      // el job ACTIVO (el que se está animando)
  queue: Job[];         // aceptados, esperando al brazo (D-10)
  noDrawer: boolean;    // true cuando la última orden se rechazó por "sin cajón"
  version: number;      // sube en cada cambio
}
```

Estado inicial: todo `Libre`, brazo `Reposo`, `job: null`, `queue: []`, `noDrawer: false`.

### 5.2 WebSocket `/ws` (servidor → navegador, JSON)

```ts
type ServerMsg =
  | { type: 'state'; state: LabState }                                   // al conectar y en CADA cambio
  | { type: 'job_started'; job: Job }                                    // → imprimir(job.printer, job.drawer)
  | { type: 'chat'; from: 'lab' | 'operador'; text: string; ts: number } // → una línea en el chat
  | { type: 'reset' };                                                   // → resetLab() y limpiar chat
```

`job_started` se emite **solo cuando el job pasa a ser el activo** (nunca dos a la vez).

### 5.3 HTTP

| Método | Ruta | Dueño | Cuerpo → Respuesta |
|---|---|---|---|
| GET | `/api/health` | WS-0 | → `{ok:true}` |
| POST | `/api/login` | WS-0 | `{password}` → cookie `lab_session` |
| GET | `/api/state` | WS-4 | → `LabState` |
| POST | `/api/demo` | WS-4 | → `200 {ok:true}` · `409` si P1 ocupada o sin cajón |
| POST | `/api/reset` | WS-4 | → `200`; emite `reset` + `state` |
| POST | `/api/chat` | WS-5 | `{text: string, file: string\|null}` → `{ok: boolean, reply: string}` · `429` si ya atiende otra orden |
| GET | `/api/agent/health` | WS-5 | → `{ollama: boolean, model: string}` |

### 5.4 Bus en Python (lo expone WS-4, lo consume WS-5)

```python
# backend/app/bus/service.py  →  instancia única:  from app.bus.service import bus
bus.get_status() -> LabState
bus.submit_job(printer: PrinterId, preset: Preset, file: str) -> SubmitResult
#   SubmitResult(ok: bool, reason: Literal['printer_busy','no_drawer'] | None, job: Job | None)
bus.say(from_: Literal['lab','operador'], text: str) -> None     # emite evento chat
bus.reset() -> None
bus.subscribe(callback) -> unsubscribe                           # lo usa el hub de /ws
```

### 5.5 Línea de tiempo del job activo (la marca el servidor; × `TIMELINE_SCALE`)

| t (s) | Estado en el bus | Fase | Línea de chat (`from: 'lab'`) | Lo que anima Sebas |
|---|---|---|---|---|
| aceptada | impresora `Imprimiendo`, cajón `Reservado` | `en_cola` | *(si hay otro activo)* `En cola: {file} espera al brazo.` | — |
| 0 | `job` = este, emite `job_started` | `imprimiendo` | `Imprimiendo en {P}…` | impresora se ilumina, progreso 0→100 |
| 10 | impresora `Lista`, brazo `En camino` | `recogiendo` | `Recogiendo pieza de {P}…` | aparece la pieza; brazo va a la cama, pinza cierra |
| 14 | brazo `Con pieza`, impresora `Libre` | `guardando` | — | brazo sube y va al cajón |
| 20 | cajón `Ocupado`+file, brazo `En camino` | `cerrando` | `Guardado en cajón {n}.` | pinza abre, cajón hace "ocupado", brazo regresa |
| 24 | brazo `Reposo`, `job: null` → arranca el siguiente de `queue` | — | — | todo quieto |

Líneas de quien **origina** la orden (agente o Demo), antes de la tabla: `Recibido: {file}.` (`lab`) y `Listo. {file} va a {P}, preset {preset}.` (`operador`).

### 5.6 Frontend entre módulos

```ts
// src/net  (WS-0)
interface BusClient { connected: boolean; getState(): LabState | null;
  onState(cb:(s:LabState)=>void): () => void; onJobStarted(cb:(j:Job)=>void): () => void;
  onChat(cb:(m:{from:'lab'|'operador';text:string;ts:number})=>void): () => void; onReset(cb:()=>void): () => void }
interface ApiClient { chat(text:string, file:string|null): Promise<{ok:boolean;reply:string}>; demo(): Promise<void>; reset(): Promise<void> }
interface Deps { bus: BusClient; api: ApiClient; showView(v:'dashboard'|'lab'): void }

// src/dashboard (WS-1)   — crea dentro un <div id="status-bar"></div> VACÍO
export function mountDashboard(root: HTMLElement, deps: Deps): void;
// src/status (WS-4)
export function mountStatusBar(el: HTMLElement, deps: Deps): void;
// src/lab (WS-2)
export function mountLab(root: HTMLElement, deps: Deps): LabHandle;
interface LabHandle { scene: THREE.Scene; toolbar: HTMLElement;          // toolbar: donde Sebas mete "Simular"
  getObject(name: string): THREE.Object3D;                               // lanza error si el nombre no existe
  onFrame(cb:(dtSeconds:number)=>void): () => void; resetCamera(): void; resize(): void }
// src/motion (WS-3)
export function mountMotion(lab: LabHandle, deps: Deps): Motion;
interface Motion { imprimir(printer: PrinterId, drawer: DrawerId): boolean;   // false = ignorada (ya hay una)
  isBusy(): boolean; resetLab(): void }
```

`main.ts` (WS-0) hace el cableado: `bus.onJobStarted(j => motion.imprimir(j.printer, j.drawer))`, `bus.onReset(() => motion.resetLab())`, y `lab.resize()` al mostrar la vista del lab.

### 5.7 Nombres de la escena (exactos, `object.name`)

| Nombre | Qué es | Nota |
|---|---|---|
| `P1`, `P2` | Impresoras izq./der. | Hijos: `P1-cama`, `P2-cama` (ancla donde nace la pieza) |
| `brazo` | Grupo raíz del brazo, al centro | Jerarquía: `brazo` › `brazo-base` (gira en **Y**) › `brazo-hombro` (gira en **Z**) › `brazo-codo` (gira en **Z**) › `brazo-pinza` › `pinza-izq`, `pinza-der` |
| `cajon-1` … `cajon-4` | Fila al fondo | Hijo: `cajon-N-ancla` (donde queda la pieza) |
| `pieza` | Cubo chico, **plantilla invisible** | Sebas la clona por job (D-16) |

Ejes: **Y arriba**, unidades ≈ metros, piso en `y=0`. Posiciones sugeridas: `P1 (-2,0,0)`, `P2 (2,0,0)`, `brazo (0,0,0)`, cajones en `z=-2.5`, `x = -1.5, -0.5, 0.5, 1.5`; alcance del brazo ≥ 3.2. **Elías congela las definitivas en M1 y las anota en su Bitácora; después de M1 solo cambia lo visual, no posiciones ni jerarquía.**

### 5.8 Variables de entorno (`.env`)

| Variable | Default | Para qué |
|---|---|---|
| `APP_PORT` | `8787` | Puerto del host que verá el Cloudflare Tunnel (**elegible**, D-07) |
| `APP_BIND` | `127.0.0.1` | Interfaz del host. Cambiar solo si `cloudflared` corre en contenedor |
| `LAB_PASSWORD` | *(vacío = sin auth)* | Contraseña compartida |
| `SECRET_KEY` | — | Firma de la cookie |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | En el VPS: `http://100.121.126.125:11434` |
| `OLLAMA_MODEL` | `qwen3:8b` | Alternativas ya descargadas: `qwen3-toolcalling:latest` |
| `AGENT_TIMEOUT_S` | `60` | Pasado esto el chat dice que uses Demo |
| `TIMELINE_SCALE` | `1.0` | `0.05` en tests para no esperar 24 s |

---

## 6. Fases y puntos de integración

| Punto | Cuándo | Qué entra a `main` | Desbloquea |
|---|---|---|---|
| **M0** | T+0:45 | Esqueleto WS-0: compila, corre, `?mock=1` simula un job | A los 5 |
| **M1** | T+1:15 | **E1** escena gris de Elías · **F1** bus core de Fernando | Sebas anima sobre objetos reales · Adrián integra tools reales |
| **M2** | T+2:45 | Todos los módulos completos contra mocks. Orden de merge: WS-4 → WS-5 → WS-2 → WS-3 → WS-1 | Integración |
| **M3** | T+3:30 | Camino feliz + Demo + Reiniciar funcionando en local | Deploy final |
| **M4** | T+4:15 | URL pública con contraseña; demo y plan B ensayados 2 veces | Presentar |

**Mientras corre la Fase 0 nadie está parado:** cada workstream tiene su bloque "Mientras esperas M0".

---

## 7. Workstreams

### WS-0 · Plataforma — José Luis
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/0-plataforma` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** que los otros 5 puedan trabajar en paralelo sin pisarse, y que lo que salga se pueda desplegar. **Fase 0 es bloqueante para todos: es la prioridad absoluta.**

**Fase 0 — Cimientos**
- ⬜ **P1** — Monorepo: `frontend/` (Vite + TS estricto + `three` + `@types/three`), `backend/` (`uv`, `requires-python >=3.12,<3.13`, fastapi, uvicorn, pydantic, `strands-agents[ollama]`, pytest, httpx), ampliar el `.gitignore` que ya existe, `README.md` con §4.4, y `CLAUDE.md` que diga "corre `/ws-start`, sigue `plan.md` §0 y usa las skills `/plan-update`, `/deuda` y `/ws-merge`". Agregar el script `typecheck` a `frontend/package.json` (lo usa `/ws-merge`). *Hecho cuando:* `npm run dev`, `npm run typecheck` y `uv run pytest` corren en limpio.
- ⬜ **P2** — Contratos en código: `frontend/src/contracts.ts` y `backend/app/contracts.py` (Pydantic), espejo exacto de §5. *Hecho cuando:* ambos compilan y §5 no dice nada que el código no diga.
- ⬜ **P3** — Esqueleto frontend: `index.html` con `#dashboard-root` y `#lab-root`; `views.ts`; `main.ts` con el cableado de §5.6; **stubs** de `mountDashboard` / `mountLab` / `mountMotion` / `mountStatusBar` en la carpeta de cada quien (para que todo importe y compile); `net/api.ts`, `net/bus.ts` (WebSocket real con reconexión) y `net/mock.ts` (`?mock=1`: estado inicial + job falso de 24 s al llamar `demo()` o `chat()`). *Hecho cuando:* con `?mock=1` se ve en consola la secuencia completa de §5.5.
- ⬜ **P4** — Esqueleto backend: `main.py` (app factory, incluye routers de `bus/` y `agent/`, sirve `frontend/dist`), `config.py` (§5.8), `/api/health`, routers **stub** que responden `501`. *Hecho cuando:* `GET /api/health` → 200 y `/` sirve el build.
- ⬜ **P5** — Push a `main` = **M0**. Crear las 6 ramas. Avisar al equipo y anotar **T+0:00** en §1.

**Fase 1 — en paralelo con los demás**
- ⬜ **P6** — Auth (D-09): `auth.py`, página mínima `/login`, cookie firmada, middleware que protege todo (incluido `/ws`) salvo `/api/health` y `/login`. Apagada si `LAB_PASSWORD` está vacío.
- ⬜ **P7** — `Dockerfile` multi-stage + `docker-compose.yml`: `ports: "${APP_BIND}:${APP_PORT}:8000"`, `mem_limit: 512m`, `cpus: 1.0`, `restart: unless-stopped`, **1 worker**; `.env.example`. *Hecho cuando:* `docker compose up --build` sirve la app en el puerto elegido.
- ⬜ **P8** — Ollama por Tailscale en la Mac: que escuche en la IP del tailnet (`launchctl setenv OLLAMA_HOST 100.121.126.125:11434` y reiniciar Ollama; si da problemas, `0.0.0.0`), `OLLAMA_KEEP_ALIVE=-1`, y Mac sin dormir (`caffeinate -dims` o Sereno). *Hecho cuando:* desde el VPS `curl http://100.121.126.125:11434/api/tags` lista `qwen3:8b`.
- ⬜ **P9** — **Deploy temprano del esqueleto** (no esperar al final): `scripts/deploy.sh` = `rsync` (sin `node_modules`, `.venv`, `.git`) + `ssh … docker compose up -d --build`; elegir `APP_PORT` libre (`ss -ltn`); alta de `lab.imperioon.com → http://localhost:${APP_PORT}` en el túnel existente. *Hecho cuando:* la URL pública pide contraseña y muestra el esqueleto, y **desde dentro del contenedor** se alcanza Ollama (si no: `network_mode: host`, ver R3).

**Fase 2–3**
- ⬜ **P10** — Integración en el orden de M2, resolver conflictos, quitar stubs, cableado final de `main.ts`.
- ⬜ **P11** — Smoke test local con el guion de §9 → **M3**. Revisar `Deuda_Tecnica.md`: ninguna 🔴 abierta sin mitigación para el demo, y cero `TODO` huérfanos (comandos en ese archivo).
- ⬜ **P12** — Deploy final + 2 ensayos completos (agente y plan B) en la URL pública → **M4**.

**Subagentes:** P1→P2 en serie; después **P3 ∥ P4** (frontend y backend no comparten archivos). En Fase 1: **P6 ∥ P7 ∥ P8**, luego P9.

**Bitácora WS-0**
- _(vacía)_

---

### WS-1 · Dashboard — Daniela
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/1-dashboard` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** la pantalla principal. Una sola columna: botón **Ver laboratorio** arriba (siempre visible) → **Visualizador STL** → **Mensajes** → franja `#status-bar`.
**Carpeta:** `frontend/src/dashboard/` y `frontend/public/samples/`. **Depende de:** M0. **No depende de nadie más** (usa `?mock=1`).

**Mientras esperas M0:** consigue o genera `base-dron.stl` (chico, < 2 MB) y boceta el layout.

- ⬜ **D1** — Layout y estilos: una columna, botón arriba fijo, y un `<div id="status-bar"></div>` **vacío** de una línea al fondo. *Hecho cuando:* se ve bien en 1280×720 y la franja vacía no rompe nada.
- ⬜ **D2** — Visor STL: `STLLoader` + `OrbitControls`, encuadre automático a la pieza, su propio renderer (independiente del lab). Si falla: nombre del archivo + "no se pudo mostrar". No mide, no slicea, **no sube el archivo** (D-13).
- ⬜ **D3** — Chat: adjuntar · texto · Enviar. Pinta el mensaje del usuario al instante. **Input bloqueado con "pensando…"** mientras `api.chat()` está en vuelo.
- ⬜ **D4** — Conexión: `deps.api.chat(text, file?.name ?? null)`; **las líneas del lab y del operador se pintan solo desde `deps.bus.onChat`** (D-14), no desde la respuesta del POST. `ok:false`, error de red o `429` → línea de error corta y desbloquear. `bus.onReset` → limpiar chat.
- ⬜ **D5** — Botón "Ver laboratorio" → `deps.showView('lab')`.
- ⬜ **D6** — `public/samples/base-dron.stl` en el repo.

**Subagentes:** D1 primero; luego **D2 ∥ D3** (archivos distintos); D4 al final.
**Lista cuando:** adjuntas `base-dron.stl` y se ve · escribes "4 motores, 250 mm", Enviar, y (con `?mock=1`) salen las líneas de prueba · la franja está vacía pero no se rompe · "Ver laboratorio" abre la otra vista.
**No hace:** lab embebido, tercera columna, settings, textos de la franja (son de Fernando).

**Bitácora WS-1**
- _(vacía)_

---

### WS-2 · Lab 3D — Elías
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/2-lab` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** la vista a pantalla completa del lab (`#lab-root`). Escena **quieta**: solo se mueve la cámara.
**Carpeta:** `frontend/src/lab/`. **Depende de:** M0. **Desbloquea a:** Sebas (por eso **E1 va primero y se mergea solo**).

**Mientras esperas M0:** define en papel posiciones y proporciones (§5.7) y el encuadre 3/4 donde quepan P1, P2, brazo y los 4 cajones.

- ⬜ **E1** — **"Escena gris" → merge inmediato a `main` (M1).** Renderer + cámara 3/4 + `OrbitControls` + **todos los nombres de §5.7** como primitivas grises en su posición final, con la jerarquía del brazo y las anclas (`P1-cama`, `cajon-N-ancla`). `LabHandle` completo aunque feo (`getObject`, `onFrame`, `toolbar`, `resize`, `resetCamera`). Anota posiciones finales en tu Bitácora. *Hecho cuando:* `lab.getObject(n)` responde para cada nombre de §5.7.
- ⬜ **E2** — Toolbar: **Volver** (arriba izq. → `deps.showView('dashboard')`) y **Reset cámara** (arriba der.). `toolbar` queda como contenedor donde Sebas agrega "Simular".
- ⬜ **E3** — Look: P1 y P2 **distinguibles sin leer** (color distinto + número grande "1"/"2"), camas visibles, números en cajones, luz de techo + una frontal, piso y paredes. Nada más.
- ⬜ **E4** — Cámara: límites de órbita (no bajo el piso), zoom mín/máx, `resize()` correcto al volver a la vista. Sin WASD, sin pointer lock.

**Subagentes:** E1 solo y rápido (≤ 30 min). Después **E2 ∥ E3**, y E4 al final.
**Lista cuando:** el botón de Daniela abre esta vista · se lee "lab de dos impresoras" sin explicación · se distinguen P1, P2, brazo y 4 cajones · órbita funciona y Reset regresa al 3/4 · Volver regresa · los nombres existen y se piden por nombre.
**No hace:** animar impresión ni brazo, chat, visor STL, franja, elegir impresora, IK, primera persona.
⚠️ **Después de M1 no muevas posiciones ni jerarquía**: romperías las poses de Sebas.

**Bitácora WS-2**
- _(vacía — aquí van las posiciones congeladas en M1)_

---

### WS-3 · Movimiento — Sebas
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/3-motion` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** la coreografía fija de **24 s**, siempre igual. Sin IK, sin física.
**Carpeta:** `frontend/src/motion/`. **Depende de:** M0 y **M1** (objetos reales de Elías). **No construye la sala.**

**Mientras esperas M1:** haz **S1** (no necesita escena) y prueba con `motion/dev-scene.ts`, una escena mínima tuya con los mismos nombres de §5.7 (se borra en la integración).

- ⬜ **S1** — Motor de timeline **basado en reloj** (no en conteo de frames: debe avanzar aunque la vista del lab esté oculta): `imprimir(printer, drawer)` → `false` si ya hay una en curso; `isBusy()`; enganchado a `lab.onFrame`.
- ⬜ **S2** — **Poses en espacio de articulaciones** (D-18). Cada pose = ángulos de `brazo-base` (Y), `brazo-hombro` (Z), `brazo-codo` (Z). Solo son **7**: `reposo`, `sobre-P1`, `sobre-P2`, `sobre-cajon-1…4`, más una pose `alto` intermedia para no atravesar la impresora. Las 8 rutas salen de combinarlas: `reposo → alto → sobre-P → alto → sobre-cajon → reposo`. Interpolación suave (ease in/out). Se colocan a mano **una vez** y no se tocan en el demo.
- ⬜ **S3** — 0–10 s: la impresora indicada se ilumina; progreso 0→100 sobre la cama; al segundo 10 aparece un **clon** de `pieza` en `P-cama`.
- ⬜ **S4** — 10–24 s: brazo a la cama → pinza cierra (la pieza se vuelve hija de `brazo-pinza`) → sube → va al cajón → pinza abre (la pieza se vuelve hija de `cajon-N-ancla`) → el cajón hace su movimiento corto de "ocupado" → brazo a reposo.
- ⬜ **S5** — Botón **Simular** en `lab.toolbar`: con bus conectado → `deps.api.demo()`; sin bus → `imprimir('P1','cajon-1')` local (D-17). Un segundo clic no corta el que ya corre.
- ⬜ **S6** — `resetLab()`: borra clones, apaga luces, brazo a reposo, cajones a su sitio.
- ⬜ **S7** *(Fase 4)* — al cargar, colocar piezas en los cajones que el estado ya trae como `Ocupado`.

**Subagentes:** S1 primero; luego **S2 ∥ S3**; S4 necesita ambas; S5 y S6 al final.
**Lista cuando:** Simular dura ~24 s · se ve P1 trabaja → pieza nace → brazo recoge → cajón-1 se ocupa → brazo en reposo · el brazo no se mete dentro de P1 · `imprimir('P2','cajon-3')` usa esa ruta, no la de P1.
**No hace:** la sala, la cámara, el chat, el STL, la franja, el agente, IK, caminar.

**Bitácora WS-3**
- _(vacía)_

---

### WS-4 · Estado y plan B — Fernando
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/4-estado` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** el **único** estado del lab (el bus). Nadie pregunta "¿P1 está libre?": lo leen ahí. **Fernando es el único que escribe el estado.** Y el botón Demo, que es el seguro de vida del equipo.
**Carpetas:** `backend/app/bus/`, `backend/tests/test_bus_*.py`, `frontend/src/status/`. **Depende de:** M0. **Desbloquea a:** Adrián (por eso **F1 va primero y se mergea solo**).

**Mientras esperas M0:** escribe los casos de prueba de F5 en pseudocódigo a partir de §5.4 y §5.5.

- ⬜ **F1** — **Bus core → merge inmediato a `main` (M1).** `service.py` según §5.4: estado inicial, `get_status`, `submit_job` (rechaza `printer_busy`; reserva el **primer cajón libre** 1→4; 4 llenos → `no_drawer` + `noDrawer:true`), `say`, `reset`, `subscribe`. Sin tiempos todavía. Con pytest.
- ⬜ **F2** — `timeline.py`: tareas `asyncio` que marcan §5.5 × `TIMELINE_SCALE`; **cola** (D-10): al terminar el activo arranca el siguiente y se emite su `job_started`; líneas de chat de la tabla.
- ⬜ **F3** — `routes.py`: `GET /api/state`, `POST /api/demo`, `POST /api/reset`, y `WS /ws` (manda `state` al conectar y reenvía todo lo del bus a todos los clientes).
- ⬜ **F4** — `status/`: `mountStatusBar(el, deps)`. **Una línea**: `P1 Imprimiendo · P2 Libre · Brazo En camino · Cajones 1:base-dron.stl 2:— 3:— 4:— · Job base-dron.stl`, más `sin cajón` cuando aplique, y los botones **Demo** y **Reiniciar** (discreto). Se pinta desde `bus.onState`.
- ⬜ **F5** — **Demo** = lo que haría Adrián: `say('lab','Recibido: base-dron.stl.')` → `submit_job('P1','estructural','base-dron.stl')` → `say('operador','Listo. base-dron.stl va a P1, preset estructural.')`; lo demás lo pone la línea de tiempo. Si P1 está ocupada o no hay cajón: `409` y **no interrumpe nada**.
- ⬜ **F6** — Tests: P1 ocupada → rechaza · 2ª orden a P2 hace cola y arranca sola · 4 cajones llenos → `no_drawer` · `reset` deja el estado inicial · la secuencia de §5.5 sale en orden (con `TIMELINE_SCALE=0.05`).

**Subagentes:** F1 solo y rápido. Después **F2 ∥ F3 ∥ F4** (archivos distintos); F5 y F6 al final.
**Lista cuando:** sin Adrián, aprietas Demo: la franja cambia, el chat escribe y el lab de Sebas corre. A los 24 s: cajón 1 ocupado, brazo en reposo.

**Bitácora WS-4**
- _(vacía)_

---

### WS-5 · Operador (agente) — Adrián
> **Estado:** ⬜ No iniciado
> **Rama:** `ws/5-agente` · **Agente activo:** —
> **Trabajando ahora en:** —
> **Última actualización:** —

**Objetivo:** el agente que recibe el chat, mira el lab, decide **impresora + preset + frase**, y lanza la orden con sus 2 tools.
**Carpetas:** `backend/app/agent/`, `backend/tests/test_agent_*.py`. **Depende de:** M0; de **M1** para usar el bus real (antes, un `FakeBus` en tus tests con la firma de §5.4).

**Mientras esperas M0 (A0):** en una carpeta temporal fuera del repo, verifica que tu Ollama responde y que un "hola mundo" de Strands con **una tool** funciona con `qwen3:8b` (si no entra, `qwen3:4b`). Revisa en la doc actual de Strands el import de `OllamaModel` y cómo apagar el *thinking* de qwen3 (parámetro `think:false` de Ollama, o `/no_think` en el prompt). Anota lo que funcionó en tu Bitácora.

- ⬜ **A1** — `tools.py`: `get_lab_status()` (resumen compacto del estado) y `send_to_printer(impresora, preset, archivo)` → llama `bus.submit_job`; devuelve texto claro: `OK: … cajón reservado cajon-1` / `RECHAZADO: P1 está ocupada` / `RECHAZADO: sin cajón`. **El agente nunca elige cajón.** Tests con `FakeBus`.
- ⬜ **A2** — `operator.py`: Strands + `OllamaModel(host=OLLAMA_BASE_URL, model_id=OLLAMA_MODEL)`, temperatura 0, *thinking* apagado, tope de iteraciones de tools, **sin memoria entre órdenes** (D-15). *System prompt* con las reglas: siempre llama `get_lab_status` primero · elige impresora `Libre` · preset por el texto (`fino` = detalle/estética, `estructural` = carga/motores/soportes, `normal` = lo demás) · si la tool rechaza, prueba la otra impresora · si ambas ocupadas **no** llames `send_to_printer` y di que espere · si no hay archivo, pídelo · respuesta de **una frase**: `Listo. {archivo} va a {P}, preset {preset}.` · nunca inventes que algo está libre.
- ⬜ **A3** — `routes.py` `POST /api/chat`: candado de una orden a la vez (`429` si ocupado) · `bus.say('lab','Recibido: {file}.')` · correr el agente con `AGENT_TIMEOUT_S` · publicar la respuesta con `bus.say('operador', reply)`. **Guardia anti-alucinación:** si la respuesta dice "Listo" pero en este turno ningún `send_to_printer` devolvió `OK`, se sustituye por un mensaje seguro. Ollama caído o timeout → `ok:false` y línea `Operador no disponible. Usa Demo.`
- ⬜ **A4** — `GET /api/agent/health` + *warm-up* del modelo al arrancar (que la primera orden del demo no pague la carga).
- ⬜ **A5** — Guion de aceptación (script o test marcado `ollama`): ① lab libre + `base-dron.stl` + "4 motores, 250 mm" → P1, estructural · ② P1 ocupada → P2 · ③ ambas ocupadas → **no** llama `send_to_printer`, dice que espere · ④ sin archivo → lo pide. Correr cada uno **5 veces** y anotar el porcentaje de acierto en la Bitácora.

**Subagentes:** **A1 ∥ A2**; luego A3; A4 y A5 al final.
**Lista cuando:** le mandas `base-dron.stl` + "4 motores, 250 mm" y consulta el lab, elige impresora libre y deja el job en el bus. Con P1 ocupada, la siguiente va a P2. Con ambas ocupadas, no llama `send_to_printer` y dice que espere.
**No decide:** diseñar la pieza, slicear, mover el brazo, el cajón.
⚠️ Si a **T+3:00** A5 acierta menos de 4/5 en el escenario ①, avisa a WS-0: se presenta con Demo.

**Bitácora WS-5**
- _(vacía)_

---

## 8. Despliegue  *(WS-0)*

**Reglas del VPS (D-08) — `imperioonserver` tiene muchas cosas corriendo:**
- ❌ No instalar paquetes, no tocar firewall, no tocar otros contenedores ni configuraciones existentes, no usar 80/443.
- ✅ Lo único que se crea: **una carpeta** del proyecto, **un** proyecto compose (`name: lab-operador`), **un** puerto en `127.0.0.1:${APP_PORT}`, **un** hostname nuevo en el Cloudflare Tunnel.
- Antes de elegir `APP_PORT`: `ss -ltn | grep :<puerto>` para confirmar que está libre.
- Para quitarlo todo: `docker compose down`, borrar la carpeta y borrar el hostname del túnel.

**Pasos:** ① `.env` en el VPS a partir de `.env.example` · ② `scripts/deploy.sh` (rsync + `docker compose up -d --build`) · ③ hostname `lab.imperioon.com → http://localhost:${APP_PORT}` en el túnel existente (WebSocket funciona por defecto) · ④ verificar `https://lab.imperioon.com/api/health`, login, `/ws` conectado y `/api/agent/health` con `ollama:true`.

---

## 9. Guion del demo (2 minutos) y plan B

**Antes de salir:** Mac despierta y en Tailscale · `/api/agent/health` OK · modelo caliente · **Reiniciar** el lab · `base-dron.stl` a la mano.

1. Dashboard. Adjuntar `base-dron.stl` → se ve y se orbita.
2. Escribir "4 motores, 250 mm" → Enviar → *pensando…* → `Listo. base-dron.stl va a P1, preset estructural.`
3. **Ver laboratorio** → P1 iluminada imprimiendo → nace la pieza → el brazo la recoge → cajón 1 → reposo.
4. Volver → la franja dice cajón 1 ocupado. Mandar otra orden mientras tanto → va a **P2** (D-10).
5. Cierre: "no es un chatbot, es un operador de lab".

| Si falla… | Plan B |
|---|---|
| El agente tarda o se equivoca | Botón **Demo** de la franja: mismo resultado visible, sin LLM |
| La Mac / Tailscale / Ollama se caen | Igual: **Demo**. El resto de la app no depende del modelo |
| Se cae el backend o el VPS | Correr en local en la laptop; y si ni eso, `?mock=1` + **Simular** |
| Los 4 cajones llenos | **Reiniciar** |

---

## 10. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R1 | qwen3:8b falla en tool-calling o alucina "Listo" | Temperatura 0, prompt estricto, la tool valida siempre, guardia de A3, medición A5, **Demo** |
| R2 | La Mac se duerme o cambia de red a media demo | `caffeinate`, `KEEP_ALIVE=-1`, warm-up, **Demo** |
| R3 | El contenedor no alcanza la IP de Tailscale del host | Probarlo **temprano** en P9; alternativa `network_mode: host` |
| R4 | Sebas bloqueado esperando a Elías | **M1**: escena gris en ≤ 30 min; mientras, `dev-scene.ts` |
| R5 | Conflictos de merge con 6 agentes a la vez | Propiedad de archivos (§4.3), contratos congelados (§5), `plan.md` por secciones y solo en `main` |
| R6 | Más de un worker de uvicorn → estados distintos | Fijado a **1 worker** en el Dockerfile (D-04) |
| R7 | No alcanza el tiempo | Orden de sacrificio: S7 → E3 (look) → A (agente, se presenta con Demo). **Nunca** se sacrifican F5 (Demo) ni S4 |

---

## 11. Pendientes por confirmar  *(WS-0 los cierra y los mueve a §3)*

- [ ] Subdominio definitivo (propuesto `lab.imperioon.com`).
- [ ] ¿`cloudflared` en el VPS corre en el host o en contenedor? Define `APP_BIND` y la URL de origen del hostname.
- [ ] Usuario SSH y carpeta destino en el VPS.
- [x] ¿Los 5 compañeros ya son colaboradores con `push`? **Sí** (verificado 2026-09-17 con `gh`): `Adr1anBaz` (admin) y con `write`: `JoseLuis0022`, `DanyFon2003`, `elias-papu`, `SebasEng`, `Rimuru022`.
- [ ] ¿Quién tiene un `base-dron.stl` real? Si nadie, Daniela genera uno simple.
- [ ] Hora real del demo → fija T+0:00 y las ventanas de §1.
