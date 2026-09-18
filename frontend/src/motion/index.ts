// WS-3 · Sebas — Coreografía del job activo. Contrato Motion en plan.md §5.6.
// Integración M2 (WS-0): la coreografía es el Pick & Place real del UR3 de Elías (lab/mundo.ts),
// sincronizado con la línea de tiempo del servidor (§5.5): imprime de 0 a 10 s y de 10 a 24 s el brazo
// recoge la pieza y la guarda en el cajón que reservó el bus.
import type { Deps, DrawerId, LabHandle, Motion, PrinterId } from '../contracts';
import { TIMELINE } from '../contracts';
import { mundoDe } from '../lab';

/**
 * Ritmo del brazo. A 1× el Pick & Place de Elías dura ~14.5 s (medido), justo la ventana de 10 a 24 s.
 * Si el brazo acaba un poco después del servidor no pasa nada: main.ts espera a que termine antes de
 * lanzar el siguiente job de la cola (DT-0-12).
 */
const VELOCIDAD = 1.05;

export function mountMotion(lab: LabHandle, deps: Deps): Motion {
  const mundo = mundoDe(lab);

  const simular = document.createElement('button');
  simular.className = 'btn';
  simular.textContent = 'Simular';
  simular.addEventListener('click', () => {
    // Con bus conectado lo lanza el servidor; sin bus, se anima en local (plan.md D-17).
    if (deps.bus.connected) void deps.api.demo().catch((err) => console.warn('[motion] demo rechazada', err));
    else motion.imprimir('P1', 'cajon-1');
  });
  lab.toolbar.appendChild(simular);

  const motion: Motion = {
    imprimir(printer: PrinterId, drawer: DrawerId): boolean {
      if (mundo.ocupado()) return false;
      console.info(`[motion] imprimir('${printer}', '${drawer}')`);
      void mundo.imprimir(printer, drawer, {
        msImpresion: TIMELINE.printDone * 1000,
        velocidad: VELOCIDAD,
      });
      return true;
    },
    isBusy: () => mundo.ocupado(),
    resetLab() {
      void mundo.reset();
    },
  };
  return motion;
}
