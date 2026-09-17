// CONTRATOS — espejo exacto de plan.md §5. CONGELADOS: solo WS-0 los cambia.
// Su gemelo en Python es backend/app/contracts.py (DT-0-06: se mantienen a mano).
import type { Object3D, Scene } from 'three';

// ── §5.1 Tipos ────────────────────────────────────────────────────────────────
export type PrinterId = 'P1' | 'P2';
export type DrawerId = 'cajon-1' | 'cajon-2' | 'cajon-3' | 'cajon-4';
export type Preset = 'fino' | 'normal' | 'estructural';
export type PrinterStatus = 'Libre' | 'Imprimiendo' | 'Lista';
export type ArmStatus = 'Reposo' | 'En camino' | 'Con pieza';
export type JobPhase = 'en_cola' | 'imprimiendo' | 'recogiendo' | 'guardando' | 'cerrando';

export const PRINTER_IDS: readonly PrinterId[] = ['P1', 'P2'];
export const DRAWER_IDS: readonly DrawerId[] = ['cajon-1', 'cajon-2', 'cajon-3', 'cajon-4'];

export interface DrawerState {
  status: 'Libre' | 'Reservado' | 'Ocupado';
  file: string | null;
}

export interface Job {
  id: string;
  file: string;
  preset: Preset;
  printer: PrinterId;
  drawer: DrawerId;
  phase: JobPhase;
}

export interface LabState {
  printers: Record<PrinterId, PrinterStatus>;
  arm: ArmStatus;
  drawers: Record<DrawerId, DrawerState>;
  /** El job ACTIVO (el que se está animando). */
  job: Job | null;
  /** Aceptados, esperando al brazo (D-10). */
  queue: Job[];
  /** true cuando la última orden se rechazó por "sin cajón". */
  noDrawer: boolean;
  /** Sube en cada cambio. */
  version: number;
}

export function initialLabState(): LabState {
  return {
    printers: { P1: 'Libre', P2: 'Libre' },
    arm: 'Reposo',
    drawers: {
      'cajon-1': { status: 'Libre', file: null },
      'cajon-2': { status: 'Libre', file: null },
      'cajon-3': { status: 'Libre', file: null },
      'cajon-4': { status: 'Libre', file: null },
    },
    job: null,
    queue: [],
    noDrawer: false,
    version: 0,
  };
}

// ── §5.2 WebSocket /ws (servidor → navegador) ─────────────────────────────────
export type ChatFrom = 'lab' | 'operador';
export interface ChatMsg {
  from: ChatFrom;
  text: string;
  ts: number;
}

export type ServerMsg =
  | { type: 'state'; state: LabState }
  | { type: 'job_started'; job: Job }
  | ({ type: 'chat' } & ChatMsg)
  | { type: 'reset' };

// ── §5.5 Línea de tiempo del job activo (segundos) ────────────────────────────
export const TIMELINE = { printDone: 10, grabbed: 14, stored: 20, end: 24 } as const;

// ── §5.6 Frontend entre módulos ───────────────────────────────────────────────
export type ViewName = 'dashboard' | 'lab';
export type Unsubscribe = () => void;

export interface BusClient {
  readonly connected: boolean;
  getState(): LabState | null;
  onState(cb: (s: LabState) => void): Unsubscribe;
  onJobStarted(cb: (j: Job) => void): Unsubscribe;
  onChat(cb: (m: ChatMsg) => void): Unsubscribe;
  onReset(cb: () => void): Unsubscribe;
}

export interface ChatResult {
  ok: boolean;
  reply: string;
}

export interface ApiClient {
  chat(text: string, file: string | null): Promise<ChatResult>;
  demo(): Promise<void>;
  reset(): Promise<void>;
}

export interface Deps {
  bus: BusClient;
  api: ApiClient;
  showView(v: ViewName): void;
}

export interface LabHandle {
  scene: Scene;
  /** Contenedor de botones de la vista del lab; aquí Sebas agrega "Simular". */
  toolbar: HTMLElement;
  /** Lanza error si el nombre no existe (nombres exactos en plan.md §5.7). */
  getObject(name: string): Object3D;
  onFrame(cb: (dtSeconds: number) => void): Unsubscribe;
  resetCamera(): void;
  resize(): void;
}

export interface Motion {
  /** false = ignorada porque ya hay una coreografía en curso. */
  imprimir(printer: PrinterId, drawer: DrawerId): boolean;
  isBusy(): boolean;
  resetLab(): void;
}

// ── §5.7 Nombres exactos de la escena ─────────────────────────────────────────
export const SCENE_NAMES = [
  'P1', 'P2', 'P1-cama', 'P2-cama',
  'brazo', 'brazo-base', 'brazo-hombro', 'brazo-codo', 'brazo-pinza', 'pinza-izq', 'pinza-der',
  'cajon-1', 'cajon-2', 'cajon-3', 'cajon-4',
  'cajon-1-ancla', 'cajon-2-ancla', 'cajon-3-ancla', 'cajon-4-ancla',
  'pieza',
] as const;
export type SceneName = (typeof SCENE_NAMES)[number];
