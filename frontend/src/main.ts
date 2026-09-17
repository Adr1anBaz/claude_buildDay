// Arranque y cableado de la plataforma (WS-0). Contratos en plan.md §5.6.
// Cada módulo lo monta su dueño; aquí solo se conectan entre sí.
import './style.css';
import type { Deps } from './contracts';
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
bus.onJobStarted((job) => {
  if (!motion.imprimir(job.printer, job.drawer)) {
    console.warn('[main] coreografía ignorada, ya hay una en curso', job);
  }
});
bus.onReset(() => motion.resetLab());

// Expuesto solo para depurar: permite comprobar la escena desde la consola del navegador,
// p.ej. SCENE_NAMES.every(n => !!window.__lab.getObject(n))
(window as unknown as { __lab: typeof lab; __motion: typeof motion }).__lab = lab;
(window as unknown as { __lab: typeof lab; __motion: typeof motion }).__motion = motion;

window.addEventListener('resize', () => lab.resize());
showView('dashboard');
