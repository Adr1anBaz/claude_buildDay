// WS-1 · Daniela — Dashboard. Tareas D1-D6 en plan.md §7.
// Punto de entrada del módulo: conserva la firma de plan.md §5.6 y el hueco #status-bar.
// React vive SOLO dentro de esta carpeta; el resto del frontend sigue en TS puro (D-03).
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Deps } from '../contracts';
import { App } from './App';

export function mountDashboard(root: HTMLElement, deps: Deps): void {
  root.innerHTML = '';

  const reactHost = document.createElement('div');
  reactHost.className = 'dashboard-host';

  // IMPORTANTE: #status-bar se crea de forma síncrona, porque main.ts lo busca en
  // cuanto mountDashboard regresa. React lo reubica después sin recrear el nodo,
  // así que lo que monte WS-4 dentro sigue vivo.
  const statusBar = document.createElement('div');
  statusBar.id = 'status-bar';

  root.append(reactHost, statusBar);
  createRoot(reactHost).render(createElement(App, { deps, statusBar }));
}
