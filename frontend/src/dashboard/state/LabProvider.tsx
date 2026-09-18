// WS-1 · Daniela — Estado del dashboard. Único punto donde el frontend habla con el bus.
// Los componentes visuales solo leen de aquí: no se suscriben al WebSocket por su cuenta.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Deps, LabState } from '../../contracts';
import { MAX_LOGS, SINGLE_ACTIVE_ORDER } from '../config';
import { diffToLogs, findOwnJob, isStoredAndReady, makeLog } from '../services/labAdapter';
import { submitOrder } from '../services/orderService';
import type { ChatEntry, LogEntry, Order } from '../types';

const SIN_ORDEN: Order = { status: 'sin-orden', file: null, jobId: null, drawer: null, reason: null };

interface LabContextValue {
  deps: Deps;
  /** Último estado que reportó el servidor. `null` = todavía no llegó ninguno. */
  state: LabState | null;
  connected: boolean;
  chat: ChatEntry[];
  logs: LogEntry[];
  order: Order;
  /** El operador está procesando una instrucción (solo eso enseña "Pensando…"). */
  agentBusy: boolean;
  /** Archivo .stl elegido por el usuario. Seleccionarlo NO manda nada al agente. */
  file: File | null;
  selectFile(file: File | null): void;
  /** Manda archivo + explicación juntos. Devuelve true solo si el backend aceptó. */
  send(text: string): Promise<boolean>;
}

const LabContext = createContext<LabContextValue | null>(null);

export function useLab(): LabContextValue {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab() fuera de <LabProvider>');
  return ctx;
}

let chatSeq = 0;

export function LabProvider({ deps, children }: { deps: Deps; children: ReactNode }) {
  const [state, setState] = useState<LabState | null>(() => deps.bus.getState());
  const [connected, setConnected] = useState(deps.bus.connected);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [order, setOrder] = useState<Order>(SIN_ORDEN);
  const [agentBusy, setAgentBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Refs para no re-suscribirse: el efecto del bus se monta UNA vez.
  const orderRef = useRef<Order>(SIN_ORDEN);
  const prevStateRef = useRef<LabState | null>(null);
  const lastVersionRef = useRef<number | null>(null);
  const seenChatRef = useRef<Set<string>>(new Set());

  const pushLogs = useCallback((entries: LogEntry[]) => {
    if (entries.length === 0) return;
    setLogs((prev) => [...prev, ...entries].slice(-MAX_LOGS));
  }, []);

  const addChat = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    setChat((prev) => [...prev, { ...entry, id: `msg-${++chatSeq}` }]);
  }, []);

  const applyOrder = useCallback((next: Order) => {
    orderRef.current = next;
    setOrder(next);
  }, []);

  // ── Suscripción única al bus (§5.2) ─────────────────────────────────────────
  useEffect(() => {
    const { bus } = deps;

    const onState = (s: LabState): void => {
      // Ignora repeticiones del mismo estado: evita logs duplicados al reconectar
      // o al volver a suscribirse (onState reenvía el último estado conocido).
      if (lastVersionRef.current === s.version) return;
      lastVersionRef.current = s.version;

      pushLogs(diffToLogs(prevStateRef.current, s));
      prevStateRef.current = s;
      setState(s);

      // Seguimiento de la orden propia: todo sale del estado del servidor (§13.B).
      const current = orderRef.current;
      if (current.status === 'activa' && current.file) {
        if (!current.jobId) {
          const own = findOwnJob(s, current.file);
          if (own) {
            applyOrder({ ...current, jobId: own.id, drawer: own.drawer });
            pushLogs([makeLog('orden', 'ok', `Tu orden es el job ${own.id}, cajón ${own.drawer.slice(-1)}.`)]);
          } else if (s.noDrawer) {
            applyOrder({ ...current, status: 'rechazada', reason: 'No hay cajón libre en el laboratorio.' });
          }
        } else if (isStoredAndReady(s, current.jobId, current.drawer)) {
          // DT-1-04: el contrato no tiene evento de "pieza recogida"; esto es lo último que reporta el servidor.
          applyOrder({ ...current, status: 'lista' });
          pushLogs([makeLog('orden', 'ok', 'Pieza guardada. Lista para recoger.')]);
        }
      }
    };

    const onChat = (m: { from: 'lab' | 'operador'; text: string; ts: number }): void => {
      const key = `${m.from}|${m.ts}|${m.text}`;
      if (seenChatRef.current.has(key)) return; // no repetir tras una reconexión
      seenChatRef.current.add(key);
      addChat({ author: m.from, text: m.text, ts: m.ts });
      pushLogs([makeLog(m.from === 'lab' ? 'laboratorio' : 'operador', 'info', m.text, m.ts)]);
    };

    const onJob = (j: { id: string; file: string; printer: string }): void => {
      pushLogs([makeLog('orden', 'ok', `Arranca el job ${j.id}: ${j.file} en ${j.printer}.`)]);
    };

    const onReset = (): void => {
      // Reiniciar es de WS-4: aquí solo se limpia lo propio. Nada de estados viejos en pantalla.
      lastVersionRef.current = null;
      prevStateRef.current = null;
      seenChatRef.current.clear();
      setChat([]);
      applyOrder(SIN_ORDEN);
      setAgentBusy(false);
      setLogs([makeLog('bus', 'warn', 'El laboratorio se reinició. Chat y orden limpiados.')]);
    };

    const unsubs = [bus.onState(onState), bus.onChat(onChat), bus.onJobStarted(onJob), bus.onReset(onReset)];
    return () => unsubs.forEach((u) => u());
  }, [deps, addChat, applyOrder, pushLogs]);

  // ── Estado de la conexión ───────────────────────────────────────────────────
  // `BusClient` (§5.6) no avisa cuando cae, solo expone la bandera `connected`.
  // SOLICITUD → WS-0 (DT-1-05): un `onConnection(cb)` y esto deja de ser un sondeo.
  useEffect(() => {
    const id = window.setInterval(() => {
      setConnected((prev) => (prev === deps.bus.connected ? prev : deps.bus.connected));
    }, 1000);
    return () => window.clearInterval(id);
  }, [deps]);

  const wasConnected = useRef(connected);
  useEffect(() => {
    if (wasConnected.current === connected) return;
    wasConnected.current = connected;
    pushLogs([
      connected
        ? makeLog('conexión', 'ok', 'Conectado al laboratorio.')
        : makeLog('conexión', 'error', 'Conexión perdida. Reintentando…'),
    ]);
  }, [connected, pushLogs]);

  // ── Acciones ────────────────────────────────────────────────────────────────
  const selectFile = useCallback((next: File | null) => {
    setFile(next);
    if (next) pushLogs([makeLog('frontend', 'info', `Archivo seleccionado: ${next.name}.`)]);
  }, [pushLogs]);

  const send = useCallback(async (text: string): Promise<boolean> => {
    if (!file) return false;
    const ts = Date.now();
    addChat({ author: 'usuario', text, ts, file: file.name });
    setAgentBusy(true);
    applyOrder({ status: 'enviando', file: file.name, jobId: null, drawer: null, reason: null });
    pushLogs([makeLog('frontend', 'info', `Orden enviada: ${file.name}.`)]);

    const outcome = await submitOrder(deps.api, { text, file });
    setAgentBusy(false);

    if (!outcome.accepted) {
      const reason = outcome.error ?? 'El laboratorio no aceptó la orden.';
      applyOrder({ status: 'rechazada', file: file.name, jobId: null, drawer: null, reason });
      addChat({ author: 'sistema', text: reason, ts: Date.now(), error: true });
      pushLogs([makeLog('orden', 'error', reason)]);
      return false;
    }

    // Aceptada. Las líneas del lab y del operador NO se pintan desde aquí:
    // llegan por el bus, igual que para todos los navegadores (D-14).
    applyOrder({ status: 'activa', file: file.name, jobId: null, drawer: null, reason: null });
    pushLogs([makeLog('orden', 'ok', 'El backend confirmó la orden.')]);
    return true;
  }, [file, deps, addChat, applyOrder, pushLogs]);

  const value = useMemo<LabContextValue>(() => ({
    deps, state, connected, chat, logs, order, agentBusy, file, selectFile, send,
  }), [deps, state, connected, chat, logs, order, agentBusy, file, selectFile, send]);

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

/** ¿Se puede mandar una orden nueva? Distingue agente ocupado de orden en curso (§13.B). */
export function useCanSend(): { locked: boolean; reason: 'agente' | 'orden' | null } {
  const { agentBusy, order } = useLab();
  if (agentBusy) return { locked: true, reason: 'agente' };
  if (SINGLE_ACTIVE_ORDER && (order.status === 'activa' || order.status === 'enviando')) {
    return { locked: true, reason: 'orden' };
  }
  return { locked: false, reason: null };
}
