// Bus y API simulados para trabajar SIN backend: abre http://localhost:5173/?mock=1
// Reproduce la línea de tiempo de plan.md §5.5 con los mismos mensajes que manda el servidor real,
// para que Daniela, Sebas y Fernando puedan avanzar antes de que exista el bus de verdad.
import {
  initialLabState, TIMELINE,
  type ApiClient, type BusClient, type ChatMsg, type DrawerId, type Job,
  type LabState, type Preset, type PrinterId, type Unsubscribe,
} from '../contracts';

export function isMock(): boolean {
  return new URLSearchParams(location.search).has('mock');
}

export function createMock(): { bus: BusClient; api: ApiClient } {
  let state: LabState = initialLabState();
  const stateCbs = new Set<(s: LabState) => void>();
  const jobCbs = new Set<(j: Job) => void>();
  const chatCbs = new Set<(m: ChatMsg) => void>();
  const resetCbs = new Set<() => void>();
  let seq = 0;
  let timers: number[] = [];

  const push = (): void => {
    state = { ...state, version: state.version + 1 };
    for (const cb of [...stateCbs]) cb(state);
  };
  const say = (from: ChatMsg['from'], text: string): void => {
    const m: ChatMsg = { from, text, ts: Date.now() };
    for (const cb of [...chatCbs]) cb(m);
  };
  const at = (s: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, s * 1000));
  };

  function freeDrawer(): DrawerId | null {
    const found = (Object.keys(state.drawers) as DrawerId[]).find((d) => state.drawers[d].status === 'Libre');
    return found ?? null;
  }

  function submit(printer: PrinterId, preset: Preset, file: string): boolean {
    if (state.printers[printer] !== 'Libre') {
      say('lab', `${printer} está ocupada.`);
      return false;
    }
    const drawer = freeDrawer();
    if (!drawer) {
      state.noDrawer = true;
      say('lab', 'Sin cajón libre.');
      push();
      return false;
    }
    const job: Job = { id: `mock-${++seq}`, file, preset, printer, drawer, phase: 'imprimiendo' };
    state.printers[printer] = 'Imprimiendo';
    state.drawers[drawer] = { status: 'Reservado', file };
    state.job = job;
    state.noDrawer = false;
    push();

    for (const cb of [...jobCbs]) cb(job);
    say('lab', `Imprimiendo en ${printer}…`);

    at(TIMELINE.printDone, () => {
      state.printers[printer] = 'Lista';
      state.arm = 'En camino';
      state.job = { ...job, phase: 'recogiendo' };
      push();
      say('lab', `Recogiendo pieza de ${printer}…`);
    });
    at(TIMELINE.grabbed, () => {
      state.arm = 'Con pieza';
      state.printers[printer] = 'Libre';
      state.job = { ...job, phase: 'guardando' };
      push();
    });
    at(TIMELINE.stored, () => {
      state.drawers[drawer] = { status: 'Ocupado', file };
      state.arm = 'En camino';
      state.job = { ...job, phase: 'cerrando' };
      push();
      say('lab', `Guardado en cajón ${drawer.slice(-1)}.`);
    });
    at(TIMELINE.end, () => {
      state.arm = 'Reposo';
      state.job = null;
      push();
    });
    return true;
  }

  const sub = <T>(set: Set<T>, cb: T): Unsubscribe => {
    set.add(cb);
    return () => set.delete(cb);
  };

  const bus: BusClient = {
    connected: true,
    getState: () => state,
    onState: (cb) => {
      cb(state);
      return sub(stateCbs, cb);
    },
    onJobStarted: (cb) => sub(jobCbs, cb),
    onChat: (cb) => sub(chatCbs, cb),
    onReset: (cb) => sub(resetCbs, cb),
  };

  const api: ApiClient = {
    async chat(text, file) {
      const name = file ?? 'base-dron.stl';
      say('lab', `Recibido: ${name}.`);
      // Preset simulado con las mismas palabras que usará el agente real (plan.md §7 WS-5 A2).
      const t = text.toLowerCase();
      const preset: Preset = /motor|carga|soporte|estructur/.test(t)
        ? 'estructural'
        : /fino|detalle|est[eé]tic/.test(t)
          ? 'fino'
          : 'normal';
      const printer: PrinterId = state.printers.P1 === 'Libre' ? 'P1' : 'P2';
      await new Promise((r) => setTimeout(r, 600)); // simula el "pensando…"
      if (state.printers[printer] !== 'Libre') {
        const reply = 'Las dos impresoras están ocupadas. Espera a que una se libere.';
        say('operador', reply);
        return { ok: false, reply };
      }
      submit(printer, preset, name);
      const reply = `Listo. ${name} va a ${printer}, preset ${preset}.`;
      say('operador', reply);
      return { ok: true, reply };
    },
    async demo() {
      say('lab', 'Recibido: base-dron.stl.');
      if (submit('P1', 'estructural', 'base-dron.stl')) {
        say('operador', 'Listo. base-dron.stl va a P1, preset estructural.');
      }
    },
    async reset() {
      for (const t of timers) window.clearTimeout(t);
      timers = [];
      state = initialLabState();
      push();
      for (const cb of [...resetCbs]) cb();
    },
  };

  console.info('[mock] modo simulado activo (?mock=1): sin backend, línea de tiempo de 24 s');
  return { bus, api };
}
