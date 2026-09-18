// Arranque y cableado de la plataforma (WS-0). Contratos en plan.md §5.6.
// Cada módulo lo monta su dueño; aquí solo se conectan entre sí.
import './style.css';
import type { Deps, Job } from './contracts';
import { createViews } from './views';
import { createApiClient } from './net/api';
import { createBusClient } from './net/bus';
import { createMock, isMock } from './net/mock';
import { mountDashboard } from './dashboard';
import { mountLab } from './lab';
import { mountMotion } from './motion';
import { mountStatusBar } from './status';

const { dashboard, lab: labRoot, showView } = createViews((v) => {
  // El canvas necesita saber su tamaño al hacerse visible.
  if (v === 'lab') lab.resize();
});

const { bus, api } = isMock() ? createMock() : { bus: createBusClient(), api: createApiClient() };
const deps: Deps = { bus, api, showView };

// Dashboard (WS-1) y, dentro de su hueco #status-bar, la franja de estado (WS-4).
mountDashboard(dashboard, deps);
const statusBar = document.getElementById('status-bar');
if (statusBar) mountStatusBar(statusBar, deps);
else console.warn('[main] el dashboard todavía no crea #status-bar');

// Lab (WS-2) y su coreografía (WS-3).
const lab = mountLab(labRoot, deps);
const motion = mountMotion(lab, deps);

// El servidor es dueño del tiempo: cuando un job se vuelve el activo, el navegador solo anima.
// Con cola (D-10) el servidor activa el siguiente job en t=24 s exactos, y la coreografía local
// arrancó unos ms tarde por la red: si todavía está ocupada, `imprimir` devuelve false y la
// segunda pieza no se animaba nunca. Por eso los jobs esperan aquí hasta que el motor los acepte.
// TODO(DT-0-12): cambiar el sondeo por Motion.onIdle(cb) cuando WS-3 entregue.
const pendientes: Job[] = [];
let reintento: number | undefined;

function lanzarPendientes(): void {
  window.clearTimeout(reintento);
  while (pendientes.length > 0 && motion.imprimir(pendientes[0].printer, pendientes[0].drawer)) {
    pendientes.shift();
  }
  if (pendientes.length > 0) reintento = window.setTimeout(lanzarPendientes, 150);
}

bus.onJobStarted((job) => {
  pendientes.push(job);
  lanzarPendientes();
});
bus.onReset(() => {
  pendientes.length = 0;
  window.clearTimeout(reintento);
  motion.resetLab();
});

window.addEventListener('resize', () => lab.resize());
showView('dashboard');
