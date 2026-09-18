# WS-1 · Dashboard (Daniela)

Interfaz de control del laboratorio: conversación con el operador, visor STL, estado y logs.
Tareas **D1–D6** de `plan.md` §7.

## Cómo correrlo

```bash
cd frontend && npm install
npm run dev                              # http://localhost:5173  (necesita el backend en :8000)
open 'http://localhost:5173/?mock=1'     # sin backend: bus simulado, job de 24 s
npm run typecheck && npm run build       # lo que verifica /ws-merge
```

Archivo de prueba: `frontend/public/samples/base-dron.stl` (base de dron de 250 mm, 4 motores).

## Cómo encaja con el resto

Este módulo **no cambia el contrato de `plan.md` §5.6**: sigue exportando
`mountDashboard(root, deps)` y sigue creando el `<div id="status-bar">` vacío que llena WS-4.
React se monta **dentro** de esa función, así que el resto del frontend sigue en TS puro (D-03):
el lab de WS-2, la coreografía de WS-3 y la franja de WS-4 no se enteran.

`index.ts` crea `#status-bar` de forma **síncrona** porque `main.ts` lo busca en cuanto
`mountDashboard` regresa; React solo lo reubica después, sin recrear el nodo.

## Estructura

```
config.ts                 rutas, variables de entorno y flags (el único archivo que se toca al integrar)
types.ts                  tipos propios del dashboard (los del lab se importan de ../contracts)
App.tsx                   layout + MemoryRouter
index.ts                  mountDashboard(): firma de §5.6 + hueco #status-bar
dashboard.css             tema claro, alcance #dashboard-root
services/
  orderService.ts         envío de la orden: JSON (§5.3) o multipart (§13.A)
  labAdapter.ts           LabState → estado resumido y logs; correlación de la orden propia
state/
  LabProvider.tsx         única suscripción al bus; chat, logs, orden y conexión
components/               TopBar, Sidebar, ChatView, Composer, ViewerView, StatusPanel, LogsPanel,
                          ConnectionBadge, LabHandoff, Icons
```

## Rutas

| Ruta | Vista |
|---|---|
| `/` | Conversación + barra de entrada |
| `/pieza` | Visor 3D del STL (solo con archivo cargado) |
| `/estado` | Estado resumido del laboratorio |
| `/logs` | Logs técnicos |
| `/lab` | Traspaso a la vista del lab de WS-2 |

Es un **`MemoryRouter`** a propósito: la URL la manda la shell de WS-0 (`?mock=1`, `views.ts`),
así que el dashboard no se la pelea y `?mock=1` sobrevive a la navegación interna.

`/lab` es una ruta real del router, pero la vista del lab **no** vive en React: la monta `main.ts`
en `#lab-root`. El componente `LabHandoff` llama `deps.showView('lab')` y devuelve el router a `/`,
para que al volver (botón **Volver** de WS-2) el chat, el archivo y la orden sigan intactos.

## Variables de entorno (opcionales, todas con default)

| Variable | Default | Para qué |
|---|---|---|
| `VITE_LAB_ROUTE` | `/lab` | Ruta de la vista del laboratorio |
| `VITE_UPLOAD_URL` | *(vacío)* | Endpoint multipart. **Si se define, el envío deja de usar `/api/chat`** |
| `VITE_UPLOAD_FIELD_FILE` | `file` | Nombre del campo del archivo en el `FormData` |
| `VITE_UPLOAD_FIELD_TEXT` | `text` | Nombre del campo del texto en el `FormData` |

No están en `.env.example` porque ese archivo es de WS-0. **SOLICITUD → WS-0:** agregarlas cuando
se cierre el contrato de subida.

## Reglas que este módulo respeta

- **D-14** — las líneas del laboratorio y del operador se pintan **solo** desde `bus.onChat`.
  Lo único que el dashboard pinta por su cuenta es el mensaje del usuario y sus propios errores.
- **D-13** — por defecto solo viaja `file.name`; el `.stl` no se sube.
- **Nada de temporizadores** para simular progreso: el avance sale del `state` del servidor.
- `plan.md` **no se edita** desde esta rama: se publica con `/plan-update`.

## Pendientes de integración

Todos están en `Deuda_Tecnica.md` (DT-1-01 … DT-1-08). Los que necesitan una decisión del equipo:

1. **DT-1-01 🔴** — `SINGLE_ACTIVE_ORDER` bloquea la segunda orden; **D-10** y el paso 4 del demo
   (§9) quieren que se acepte y haga cola. Es un flag de una línea en `config.ts`.
2. **DT-1-02** — ¿la orden sube el archivo (multipart) o basta el nombre (D-13)?
3. **DT-1-03** — que `/api/chat` devuelva `job.id`; hoy la orden se correlaciona por nombre de archivo.
4. **DT-1-04** — no existe evento de "pieza recogida": la orden se libera cuando el cajón queda `Ocupado`.
5. **DT-1-05** — `BusClient` no avisa cuando cae la conexión; se sondea `connected` cada segundo.
