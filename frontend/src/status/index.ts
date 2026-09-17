// WS-4 · Fernando — Franja de estado + botones Demo y Reiniciar. Tarea F4 en plan.md §7.
// Una sola línea, pintada siempre desde `deps.bus.onState` (D-14: el estado solo lo escribe el bus).
import type { Deps, DrawerId, LabState } from '../contracts';

function lineaDeEstado(s: LabState): string {
  const cajones = (Object.keys(s.drawers) as DrawerId[])
    .map((d) => `${d.slice(-1)}:${s.drawers[d].file ?? '—'}`)
    .join(' ');

  let linea = `P1 ${s.printers.P1} · P2 ${s.printers.P2} · Brazo ${s.arm} · Cajones ${cajones}`;
  if (s.job) linea += ` · Job ${s.job.file}`;
  if (s.noDrawer) linea += ' · sin cajón';
  return linea;
}

export function mountStatusBar(el: HTMLElement, deps: Deps): void {
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:12px',
    'border-top:1px solid #2a2f3a',
    'padding:8px 2px 2px',
    'font-size:13px',
    'line-height:1.4',
  ].join(';');

  const texto = document.createElement('span');
  texto.style.cssText = 'flex:1;min-width:0;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  texto.textContent = 'Sin conexión con el lab todavía…';

  const demo = document.createElement('button');
  demo.type = 'button';
  demo.textContent = 'Demo';
  demo.title = 'Plan B: lanza base-dron.stl a P1 sin pasar por el agente';
  demo.style.cssText =
    'padding:6px 14px;border-radius:6px;border:1px solid #3b82f6;background:#3b82f6;color:#fff;font:inherit;cursor:pointer';
  demo.addEventListener('click', () => {
    demo.disabled = true;
    void deps.api
      .demo()
      .catch((err) => console.error('[status] /api/demo falló', err))
      .finally(() => {
        demo.disabled = false;
      });
  });

  // Discreto a propósito (D-11): reinicia todo el lab, no es una acción de todos los días.
  const reiniciar = document.createElement('button');
  reiniciar.type = 'button';
  reiniciar.textContent = 'Reiniciar';
  reiniciar.title = 'Vacía el lab para repetir el demo';
  reiniciar.style.cssText =
    'padding:5px 10px;border-radius:6px;border:1px solid #2a2f3a;background:transparent;color:#8b93a3;font:inherit;font-size:12px;cursor:pointer';
  reiniciar.addEventListener('click', () => {
    reiniciar.disabled = true;
    void deps.api
      .reset()
      .catch((err) => console.error('[status] /api/reset falló', err))
      .finally(() => {
        reiniciar.disabled = false;
      });
  });

  el.append(texto, demo, reiniciar);

  deps.bus.onState((s) => {
    texto.textContent = lineaDeEstado(s);
  });
}
