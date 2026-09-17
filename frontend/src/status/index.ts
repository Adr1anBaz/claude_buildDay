// WS-4 · Fernando — Franja de estado + botones Demo y Reiniciar. Tarea F4 en plan.md §7.
// STUB de WS-0: pinta el estado crudo. CONSERVA la firma; el formato de una línea lo define F4.
import type { Deps } from '../contracts';

export function mountStatusBar(el: HTMLElement, deps: Deps): void {
  el.style.cssText = 'display:flex;gap:12px;align-items:center;border-top:1px solid #2a2f3a;padding-top:8px;font-size:13px';
  const texto = document.createElement('span');
  texto.style.flex = '1';
  texto.style.opacity = '.7';
  const demo = document.createElement('button');
  demo.textContent = 'Demo';
  demo.addEventListener('click', () => void deps.api.demo());
  const reiniciar = document.createElement('button');
  reiniciar.textContent = 'Reiniciar';
  reiniciar.addEventListener('click', () => void deps.api.reset());
  el.append(texto, demo, reiniciar);

  deps.bus.onState((s) => {
    const cajones = (Object.keys(s.drawers) as (keyof typeof s.drawers)[])
      .map((d) => `${String(d).slice(-1)}:${s.drawers[d].file ?? '—'}`)
      .join(' ');
    texto.textContent =
      `P1 ${s.printers.P1} · P2 ${s.printers.P2} · Brazo ${s.arm} · Cajones ${cajones}` +
      (s.job ? ` · Job ${s.job.file}` : '') + (s.noDrawer ? ' · sin cajón' : '');
  });
}
