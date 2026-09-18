// WS-2 · Panel flotante del lab: el chat del bus intercalado con cada movimiento del brazo,
// para ver en qué momento va el trabajo sin salir de la vista 3D. Se puede minimizar.
import type { ChatMsg, Deps, Job, JobPhase, LabState } from '../contracts';

const FASES: { fase: JobPhase; texto: string }[] = [
  { fase: 'imprimiendo', texto: 'Imprimiendo' },
  { fase: 'recogiendo', texto: 'Recogiendo' },
  { fase: 'guardando', texto: 'Llevando al cajón' },
  { fase: 'cerrando', texto: 'Guardando' },
];
const MAX_LINEAS = 200;
const CLAVE_MIN = 'lab-bitacora-minimizada';

type Tipo = 'lab' | 'operador' | 'ur3' | 'sistema';
const QUIEN: Record<Tipo, string> = { lab: 'Laboratorio', operador: 'Operador', ur3: 'Brazo UR3', sistema: 'Sistema' };

export interface Bitacora {
  /** Etapa del brazo que reporta el mundo de Elías (su `setBanner`). */
  etapa(texto: string, clase: string): void;
}

function leerMinimizada(): boolean {
  try {
    return localStorage.getItem(CLAVE_MIN) === '1';
  } catch {
    return false;
  }
}

function guardarMinimizada(v: boolean): void {
  try {
    localStorage.setItem(CLAVE_MIN, v ? '1' : '0');
  } catch {
    /* sin almacenamiento (modo privado): solo no se recuerda */
  }
}

const hora = (ms: number): string =>
  new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function montarBitacora(root: HTMLElement, deps: Deps): Bitacora {
  const el = document.createElement('section');
  el.id = 'bitacora';
  el.setAttribute('aria-label', 'Operación en vivo');
  el.innerHTML = `
    <header class="bt-head">
      <span class="bt-titulo">Operación en vivo</span>
      <span class="bt-badge" hidden></span>
      <button class="bt-toggle" type="button"></button>
    </header>
    <div class="bt-cuerpo">
      <div class="bt-job"></div>
      <ol class="bt-fases">${FASES.map((f) => `<li>${f.texto}</li>`).join('')}</ol>
      <ul class="bt-lista" aria-live="polite"><li class="bt-vacio">Sin actividad todavía. Manda una orden desde el dashboard o pulsa Simular.</li></ul>
    </div>`;
  root.appendChild(el);

  const head = el.querySelector<HTMLElement>('.bt-head')!;
  const toggle = el.querySelector<HTMLButtonElement>('.bt-toggle')!;
  const badge = el.querySelector<HTMLElement>('.bt-badge')!;
  const jobEl = el.querySelector<HTMLElement>('.bt-job')!;
  const fasesEl = [...el.querySelectorAll<HTMLLIElement>('.bt-fases li')];
  const lista = el.querySelector<HTMLUListElement>('.bt-lista')!;

  // ── Minimizar ────────────────────────────────────────────────────────────────
  let minimizada = leerMinimizada();
  let sinLeer = 0;
  function pintarMinimizada(): void {
    el.classList.toggle('min', minimizada);
    toggle.textContent = minimizada ? '+' : '–';
    toggle.setAttribute('aria-label', minimizada ? 'Mostrar panel' : 'Minimizar panel');
    toggle.setAttribute('aria-expanded', String(!minimizada));
    badge.hidden = !minimizada || sinLeer === 0;
    badge.textContent = String(sinLeer);
  }
  head.addEventListener('click', () => {
    minimizada = !minimizada;
    if (!minimizada) sinLeer = 0;
    guardarMinimizada(minimizada);
    pintarMinimizada();
    if (!minimizada) lista.scrollTop = lista.scrollHeight;
  });
  pintarMinimizada();

  // ── Líneas del feed ──────────────────────────────────────────────────────────
  function agregar(tipo: Tipo, texto: string, ts: number, tono = ''): void {
    lista.querySelector('.bt-vacio')?.remove();
    const pegado = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;

    const li = document.createElement('li');
    li.className = `bt-item bt-${tipo}${tono ? ` bt-${tono}` : ''}`;
    const t = document.createElement('time');
    t.textContent = hora(ts);
    const q = document.createElement('span');
    q.className = 'bt-quien';
    q.textContent = QUIEN[tipo];
    const p = document.createElement('p');
    p.textContent = texto;
    li.append(t, q, p);
    lista.appendChild(li);
    while (lista.children.length > MAX_LINEAS) lista.firstElementChild?.remove();

    if (pegado) lista.scrollTop = lista.scrollHeight;
    if (minimizada) {
      sinLeer++;
      pintarMinimizada();
    }
  }

  // ── Trabajo en curso y fases (las marca el servidor, §5.5) ───────────────────
  let jobActual: Job | null = null;
  let inicio = 0;
  let cola = 0;

  function pintarJob(): void {
    el.classList.toggle('activo', jobActual !== null);
    if (!jobActual) {
      jobEl.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = 'Sin trabajo en curso';
      const small = document.createElement('small');
      small.textContent = cola > 0 ? `${cola} en cola` : 'El brazo está en reposo';
      jobEl.append(b, small);
      fasesEl.forEach((li) => (li.className = ''));
      return;
    }
    const seg = Math.max(0, Math.round((Date.now() - inicio) / 1000));
    const cajon = jobActual.drawer.replace('cajon-', 'cajón ');
    jobEl.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = `${jobActual.file} · ${jobActual.printer} → ${cajon}`;
    const small = document.createElement('small');
    small.textContent = `preset ${jobActual.preset} · t = ${seg} s de 24${cola > 0 ? ` · ${cola} en cola` : ''}`;
    jobEl.append(b, small);

    const i = FASES.findIndex((f) => f.fase === jobActual!.phase);
    fasesEl.forEach((li, k) => (li.className = k < i ? 'hecha' : k === i ? 'actual' : ''));
  }

  function alEstado(s: LabState): void {
    cola = s.queue.length;
    if (s.job?.id !== jobActual?.id) inicio = Date.now();
    jobActual = s.job;
    pintarJob();
  }

  const s0 = deps.bus.getState();
  if (s0) alEstado(s0);
  deps.bus.onState(alEstado);
  window.setInterval(() => jobActual && pintarJob(), 1000);

  deps.bus.onChat((m: ChatMsg) => agregar(m.from, m.text, m.ts));
  deps.bus.onReset(() => {
    lista.innerHTML = '';
    agregar('sistema', 'Laboratorio reiniciado.', Date.now());
  });

  return {
    etapa(texto: string, clase: string): void {
      if (texto === 'EN ESPERA') return; // es el reposo del panel de Elías, no un movimiento
      agregar('ur3', texto, Date.now(), clase === 'err' ? 'err' : clase === 'ok' ? 'ok' : '');
    },
  };
}
