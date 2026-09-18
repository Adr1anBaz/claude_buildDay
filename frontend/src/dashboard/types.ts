// WS-1 · Daniela — Tipos propios del dashboard.
// Los tipos del laboratorio NO se redefinen aquí: se importan de ../contracts (plan.md §5, congelados).

/** Quién habla en el chat. 'sistema' son avisos del propio frontend, nunca del laboratorio. */
export type ChatAuthor = 'usuario' | 'lab' | 'operador' | 'sistema';

export interface ChatEntry {
  id: string;
  author: ChatAuthor;
  text: string;
  ts: number;
  /** Marca los avisos de error del frontend para pintarlos distinto. */
  error?: boolean;
  /** Nombre del .stl que acompañaba al mensaje del usuario. */
  file?: string;
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  ts: number;
  /** Componente de origen: 'conexión', 'P1', 'brazo', 'cajones', 'operador'… */
  source: string;
  level: LogLevel;
  message: string;
}

/** Ciclo de vida de la orden de fabricación (§13.B). Lo manda el backend, no un temporizador. */
export type OrderStatus =
  | 'sin-orden'      // no hay orden; se puede enviar
  | 'enviando'       // esperando la confirmación del backend
  | 'activa'         // confirmada y en curso en el laboratorio
  | 'lista'          // el backend reporta la pieza guardada y lista para recoger
  | 'rechazada';     // el backend la rechazó (sin cajón, impresoras ocupadas, error)

export interface Order {
  status: OrderStatus;
  /** Nombre del archivo con el que se correlaciona el job en el bus. */
  file: string | null;
  /** id del job en el bus, en cuanto se puede correlacionar. */
  jobId: string | null;
  /** Cajón asignado por el backend, cuando ya lo reportó. */
  drawer: string | null;
  /** Motivo, cuando `status === 'rechazada'`. */
  reason: string | null;
}

export type Tone = 'neutral' | 'activo' | 'ok' | 'warn' | 'error';

/** Una fila del panel de estado resumido. */
export interface SummaryRow {
  label: string;
  value: string;
  tone: Tone;
}
