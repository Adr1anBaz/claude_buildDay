// WS-3 · Sebas — Coreografía de 24 s. Tareas S1-S7 en plan.md §7.
// STUB de WS-0: registra la orden en consola y respeta "una a la vez". CONSERVA la firma.
import type { Deps, DrawerId, LabHandle, Motion, PrinterId } from '../contracts';
import { TIMELINE } from '../contracts';

export function mountMotion(lab: LabHandle, deps: Deps): Motion {
  let busy = false;
  let timer: number | undefined;

  const simular = document.createElement('button');
  simular.textContent = 'Simular';
  simular.addEventListener('click', () => {
    // Con bus conectado lo lanza el servidor; sin bus, se anima en local (plan.md D-17).
    if (deps.bus.connected) void deps.api.demo();
    else motion.imprimir('P1', 'cajon-1');
  });
  lab.toolbar.appendChild(simular);

  const motion: Motion = {
    imprimir(printer: PrinterId, drawer: DrawerId): boolean {
      if (busy) return false;
      busy = true;
      console.info(`[motion stub] imprimir('${printer}', '${drawer}') — ${TIMELINE.end}s`);
      timer = window.setTimeout(() => {
        busy = false;
        console.info('[motion stub] terminado');
      }, TIMELINE.end * 1000);
      return true;
    },
    isBusy: () => busy,
    resetLab() {
      window.clearTimeout(timer);
      busy = false;
    },
  };
  return motion;
}
