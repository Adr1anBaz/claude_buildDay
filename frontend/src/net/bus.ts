// Cliente WebSocket del bus (WS-0). Mensajes en plan.md §5.2.
// El servidor manda `state` al conectar y en cada cambio; aquí solo se reparte a los módulos.
import type { BusClient, ChatMsg, Job, LabState, ServerMsg, Unsubscribe } from '../contracts';

type Handlers = {
  state: Set<(s: LabState) => void>;
  job: Set<(j: Job) => void>;
  chat: Set<(m: ChatMsg) => void>;
  reset: Set<() => void>;
};

/**
 * §5.2 no fijaba la unidad de `ts`: el servidor lo manda en SEGUNDOS (`time.time()`) y el
 * mock en MILISEGUNDOS (`Date.now()`), asi que el chat pintaba horas de enero de 1970 y
 * todas las lineas de un job salian con el mismo minuto. Aqui se normaliza a ms epoch,
 * que es lo que espera `new Date(ts)` en el navegador.
 * TODO(DT-0-11): fijar en §5.2 que ts es epoch en ms y quitar esta normalizacion.
 */
function normalizarTs(ts: number): number {
  return ts < 1e12 ? Math.round(ts * 1000) : ts;
}

function emit<T>(set: Set<(v: T) => void>, value: T): void {
  for (const cb of [...set]) {
    try {
      cb(value);
    } catch (err) {
      console.error('[bus] handler falló', err);
    }
  }
}

export function createBusClient(): BusClient {
  const h: Handlers = { state: new Set(), job: new Set(), chat: new Set(), reset: new Set() };
  let socket: WebSocket | null = null;
  let state: LabState | null = null;
  let connected = false;
  let retry = 0;
  let timer: number | undefined;

  function connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/ws`);

    socket.onopen = () => {
      connected = true;
      retry = 0;
      console.info('[bus] conectado');
    };

    socket.onmessage = (ev: MessageEvent<string>) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data) as ServerMsg;
      } catch {
        console.error('[bus] mensaje ilegible', ev.data);
        return;
      }
      switch (msg.type) {
        case 'state':
          state = msg.state;
          emit(h.state, msg.state);
          break;
        case 'job_started':
          emit(h.job, msg.job);
          break;
        case 'chat':
          emit(h.chat, { from: msg.from, text: msg.text, ts: normalizarTs(msg.ts) });
          break;
        case 'reset':
          emit(h.reset, undefined as never);
          break;
      }
    };

    socket.onclose = () => {
      connected = false;
      socket = null;
      // Reconexión con espera creciente, tope 5 s: el demo no debe morir por un parpadeo de red.
      const wait = Math.min(5000, 500 * 2 ** retry++);
      timer = window.setTimeout(connect, wait);
    };

    socket.onerror = () => socket?.close();
  }

  connect();
  window.addEventListener('beforeunload', () => {
    window.clearTimeout(timer);
    socket?.close();
  });

  const sub = <T>(set: Set<T>, cb: T): Unsubscribe => {
    set.add(cb);
    return () => set.delete(cb);
  };

  return {
    get connected() {
      return connected;
    },
    getState: () => state,
    onState: (cb) => {
      if (state) cb(state);
      return sub(h.state, cb);
    },
    onJobStarted: (cb) => sub(h.job, cb),
    onChat: (cb) => sub(h.chat, cb),
    onReset: (cb) => sub(h.reset, cb),
  };
}
