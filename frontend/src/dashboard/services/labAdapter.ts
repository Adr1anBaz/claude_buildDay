// WS-1 · Daniela — Capa de adaptación del contrato del laboratorio.
// AQUÍ se traduce lo que manda la fase 4 (plan.md §5.2) a lo que pintan los componentes.
// Si el contrato cambia, se cambia este archivo y ningún componente visual.
import { DRAWER_IDS, type DrawerId, type Job, type LabState, type PrinterId } from '../../contracts';
import { SIN_INFO } from '../config';
import type { LogEntry, LogLevel, Order, SummaryRow, Tone } from '../types';

// ── Estado resumido (§6.A) ────────────────────────────────────────────────────

const PHASE_LABEL: Record<Job['phase'], string> = {
  en_cola: 'En cola, esperando al brazo',
  imprimiendo: 'Imprimiendo',
  recogiendo: 'Brazo recogiendo la pieza',
  guardando: 'Brazo llevando la pieza al cajón',
  cerrando: 'Guardando en el cajón',
};

function printerTone(status: string): Tone {
  if (status === 'Imprimiendo') return 'activo';
  if (status === 'Lista') return 'ok';
  return 'neutral';
}

function drawersSummary(state: LabState): string {
  const busy = DRAWER_IDS.filter((d) => state.drawers[d].status !== 'Libre');
  if (busy.length === 0) return '4 cajones libres';
  return busy.map((d) => `${d.slice(-1)}: ${state.drawers[d].file ?? state.drawers[d].status}`).join(' · ');
}

/**
 * Construye las filas del panel de estado. Sin `state` (bus caído o sin primer mensaje)
 * devuelve todo en "Sin información": nunca se inventa un estado.
 */
export function buildSummary(state: LabState | null, order: Order, agentBusy: boolean): SummaryRow[] {
  const agente: SummaryRow = agentBusy
    ? { label: 'Operador', value: 'Procesando la instrucción', tone: 'activo' }
    : { label: 'Operador', value: 'Disponible', tone: 'ok' };

  if (!state) {
    return [
      { label: 'Sistema', value: SIN_INFO, tone: 'neutral' },
      agente,
      { label: 'Impresora asignada', value: SIN_INFO, tone: 'neutral' },
      { label: 'Impresión', value: SIN_INFO, tone: 'neutral' },
      { label: 'Brazo robótico', value: SIN_INFO, tone: 'neutral' },
      { label: 'Almacenamiento', value: SIN_INFO, tone: 'neutral' },
    ];
  }

  const job = state.job;
  const rows: SummaryRow[] = [
    { label: 'Sistema', value: job ? 'Fabricando' : 'En reposo', tone: job ? 'activo' : 'ok' },
    agente,
    {
      label: 'Impresora asignada',
      value: job ? `${job.printer} · preset ${job.preset}` : SIN_INFO,
      tone: job ? 'activo' : 'neutral',
    },
    {
      label: 'Impresión',
      value: job ? PHASE_LABEL[job.phase] : 'Sin trabajo en curso',
      tone: job ? 'activo' : 'neutral',
    },
    { label: 'Brazo robótico', value: state.arm, tone: state.arm === 'Reposo' ? 'neutral' : 'activo' },
    { label: 'Almacenamiento', value: drawersSummary(state), tone: 'neutral' },
  ];

  for (const p of ['P1', 'P2'] as PrinterId[]) {
    rows.push({ label: `Impresora ${p}`, value: state.printers[p], tone: printerTone(state.printers[p]) });
  }
  if (state.queue.length > 0) {
    rows.push({ label: 'En cola', value: `${state.queue.length} orden(es)`, tone: 'warn' });
  }
  if (state.noDrawer) {
    rows.push({ label: 'Cajones', value: 'Sin cajón libre: la última orden se rechazó', tone: 'error' });
  }
  if (order.status === 'lista' && order.drawer) {
    rows.push({ label: 'Tu pieza', value: `Lista para recoger en el cajón ${order.drawer.slice(-1)}`, tone: 'ok' });
  }
  return rows;
}

// ── Logs técnicos (§6.B) ──────────────────────────────────────────────────────
// DT-1-06: no hay evento de log en el contrato §5.2, así que NO se inventan registros:
// cada línea sale de un cambio real que el servidor acaba de reportar.

let seq = 0;
export function makeLog(source: string, level: LogLevel, message: string, ts?: number): LogEntry {
  return { id: `log-${++seq}`, ts: ts ?? Date.now(), source, level, message };
}

/** Compara dos estados consecutivos y describe lo que cambió. */
export function diffToLogs(prev: LabState | null, next: LabState): LogEntry[] {
  const out: LogEntry[] = [];
  if (!prev) {
    out.push(makeLog('bus', 'ok', `Estado inicial recibido (v${next.version}).`));
    return out;
  }
  for (const p of ['P1', 'P2'] as PrinterId[]) {
    if (prev.printers[p] !== next.printers[p]) {
      out.push(makeLog(p, next.printers[p] === 'Imprimiendo' ? 'ok' : 'info',
        `Impresora ${p}: ${prev.printers[p]} → ${next.printers[p]}.`));
    }
  }
  if (prev.arm !== next.arm) {
    out.push(makeLog('brazo', 'info', `Brazo robótico: ${prev.arm} → ${next.arm}.`));
  }
  for (const d of DRAWER_IDS as readonly DrawerId[]) {
    const a = prev.drawers[d];
    const b = next.drawers[d];
    if (a.status !== b.status || a.file !== b.file) {
      out.push(makeLog('cajones', b.status === 'Ocupado' ? 'ok' : 'info',
        `Cajón ${d.slice(-1)}: ${b.status}${b.file ? ` · ${b.file}` : ''}.`));
    }
  }
  const pj = prev.job;
  const nj = next.job;
  if (pj?.id !== nj?.id) {
    if (nj) out.push(makeLog('orden', 'ok', `Job ${nj.id} activo: ${nj.file} en ${nj.printer} (${nj.preset}).`));
    else if (pj) out.push(makeLog('orden', 'ok', `Job ${pj.id} terminado.`));
  } else if (pj && nj && pj.phase !== nj.phase) {
    out.push(makeLog('orden', 'info', `Fase: ${pj.phase} → ${nj.phase}.`));
  }
  if (prev.queue.length !== next.queue.length) {
    out.push(makeLog('cola', 'info', `Órdenes en cola: ${prev.queue.length} → ${next.queue.length}.`));
  }
  if (!prev.noDrawer && next.noDrawer) {
    out.push(makeLog('cajones', 'error', 'Orden rechazada: no hay cajón libre.'));
  }
  return out;
}

// ── Correlación de "mi" orden con el bus (§13.B) ──────────────────────────────
// `/api/chat` no devuelve el id del job (plan.md §5.3), así que la única forma de
// seguir la orden propia es buscar el job con el mismo nombre de archivo.
// SOLICITUD → WS-0 (DT-1-03): que `/api/chat` devuelva `job.id` y esto deja de ser heurística.

export function findOwnJob(state: LabState, file: string): Job | null {
  if (state.job?.file === file) return state.job;
  return state.queue.find((j) => j.file === file) ?? null;
}

/** ¿El backend ya reporta la pieza guardada y lista para recoger? */
export function isStoredAndReady(state: LabState, jobId: string | null, drawer: string | null): boolean {
  if (!jobId || !drawer) return false;
  const stillRunning = state.job?.id === jobId || state.queue.some((j) => j.id === jobId);
  if (stillRunning) return false;
  const d = state.drawers[drawer as DrawerId];
  return Boolean(d && d.status === 'Ocupado');
}
