// WS-2 · Elías — Lab 3D. Contrato mountLab / LabHandle en plan.md §5.6.
// La escena es el gemelo digital de Elías (mundo.ts); aquí solo se adapta al contrato de la plataforma.
import './lab.css';
import type { Deps, LabHandle } from '../contracts';
import { crearMundo } from './mundo';

export type Mundo = ReturnType<typeof crearMundo>;

// §5.7 congeló unos nombres antes de que existiera el modelo real del UR3. Estos alias los traducen a los
// del mundo de Elías para que `getObject` siga cumpliendo el contrato.
// TODO(DT-0-14): alinear §5.7 con los nombres reales y quitar los alias.
const ALIAS: Record<string, string> = {
  'P1-cama': 'P1-slot',
  'P2-cama': 'P2-slot',
  'cajon-1-ancla': 'cajon-1-slot',
  'cajon-2-ancla': 'cajon-2-slot',
  'cajon-3-ancla': 'cajon-3-slot',
  'cajon-4-ancla': 'cajon-4-slot',
  'brazo-pinza': 'gripper',
  'pinza-izq': 'finger-L',
  'pinza-der': 'finger-R',
};

const mundos = new WeakMap<LabHandle, Mundo>();

/** El mundo detrás de un LabHandle, para que motion/ use el Pick & Place de Elías. */
export function mundoDe(lab: LabHandle): Mundo {
  const mundo = mundos.get(lab);
  if (!mundo) throw new Error('[lab] ese LabHandle no lo creó mountLab');
  return mundo;
}

export function mountLab(root: HTMLElement, deps: Deps): LabHandle {
  const mundo: Mundo = crearMundo(root, {
    onVolver: () => deps.showView('dashboard'),
    // "Iniciar simulación" del panel de Elías: con servidor lo lanza el bus (D-17); sin servidor, local.
    onIniciar: (origen: string, destino: string) => {
      if (deps.bus.connected) void deps.api.demo().catch((err) => console.warn('[lab] demo rechazada', err));
      else void mundo.imprimir(origen, destino);
    },
  });

  const handle: LabHandle = {
    scene: mundo.scene,
    toolbar: mundo.toolbar,
    getObject(name: string) {
      const obj = mundo.scene.getObjectByName(ALIAS[name] ?? name);
      if (!obj) throw new Error(`[lab] no existe el objeto "${name}" en la escena (plan.md §5.7)`);
      return obj;
    },
    onFrame: mundo.onFrame,
    resetCamera: mundo.resetCamera,
    resize: mundo.resize,
  };
  mundos.set(handle, mundo);
  return handle;
}
