// WS-1 · Daniela — Configuración del dashboard.
// Todo lo que el equipo pueda necesitar cambiar al integrar vive AQUÍ, en un solo archivo.

/** Lee una variable VITE_* sin exigir que exista. */
function env(name: string): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return v && v.length > 0 ? v : undefined;
}

// ── Rutas internas (React Router) ─────────────────────────────────────────────
export const ROUTES = {
  chat: '/',
  pieza: '/pieza',
  estado: '/estado',
  logs: '/logs',
} as const;

/**
 * Ruta de la vista del laboratorio (WS-2 Elías).
 * PENDIENTE DE INTEGRACIÓN: hoy el lab NO vive en React. Lo monta `main.ts` (WS-0) en
 * `#lab-root` y se muestra con `deps.showView('lab')` (plan.md §5.6). Esta ruta existe
 * de verdad en el router: su componente hace el traspaso a la shell. Cuando WS-0 exponga
 * una ruta React real, solo cambia el componente de esta ruta.
 */
export const LAB_ROUTE = env('VITE_LAB_ROUTE') ?? '/lab';

// ── Envío de la orden (§13.A) ─────────────────────────────────────────────────
/**
 * Dos transportes, porque el contrato del equipo y el brief piden cosas distintas:
 *  - 'json'      → `POST /api/chat {text, file}` de plan.md §5.3. Es lo que el backend
 *                  entiende HOY; solo viaja el NOMBRE del archivo (decisión D-13).
 *  - 'multipart' → `FormData` con el archivo completo, como pide §13.A. Se activa solo
 *                  cuando el equipo defina el endpoint y se ponga `VITE_UPLOAD_URL`.
 * SOLICITUD → WS-0 (DT-1-02): si la orden debe subir el .stl de verdad, hay que abrir D-13 y §5.3.
 */
export const UPLOAD_URL = env('VITE_UPLOAD_URL');
export const ORDER_TRANSPORT: 'json' | 'multipart' = UPLOAD_URL ? 'multipart' : 'json';

/** Nombres de campo del FormData, configurables porque el contrato aún no existe. */
export const UPLOAD_FIELDS = {
  file: env('VITE_UPLOAD_FIELD_FILE') ?? 'file',
  text: env('VITE_UPLOAD_FIELD_TEXT') ?? 'text',
} as const;

// ── Reglas de operación ───────────────────────────────────────────────────────
/**
 * §13.B: una sola orden de fabricación activa.
 * ⚠️ DT-1-01 — CHOCA CON D-10 y con el paso 4 del guion del demo (plan.md §9), donde se manda
 * una segunda orden a propósito para que salga en P2. El backend SÍ la acepta y la
 * encola. Ponlo en `false` para dejar pasar la segunda orden.
 */
export const SINGLE_ACTIVE_ORDER = false; // DT-1-01: gana D-10 (decisión WS-0, 19:00)

/** Tope de eventos que se guardan en el visor de logs. */
export const MAX_LOGS = 400;

/** Textos de estado del input, en un solo lugar. */
export const INPUT_HINTS = {
  pensando: 'Pensando…',
  ordenActiva: 'Orden en proceso. Espera a que finalice para enviar otra pieza.',
  sinArchivo: 'Adjunta un archivo .stl para empezar.',
  listo: 'Describe la pieza, cómo funciona y para qué la vas a usar.',
  desconectado: 'Sin conexión con el laboratorio. Reintentando…',
} as const;

export const SIN_INFO = 'Sin información';
