// WS-1 · Daniela — Dashboard. Tareas D1-D6 en plan.md §7.
// Pantalla principal, una sola columna: botón "Ver laboratorio" (siempre visible)
// → visor STL → chat → #status-bar (vacío, lo llena WS-4).
import './dashboard.css';
import type { Deps } from '../contracts';
import { mountStlViewer } from './stl-viewer';
import { mountChat } from './chat';

export function mountDashboard(root: HTMLElement, deps: Deps): void {
  root.innerHTML = `
    <div class="dashboard">
      <div class="dashboard__topbar">
        <button id="ver-lab" class="btn-primary dashboard__ver-lab" type="button">Ver laboratorio</button>
      </div>

      <div class="dashboard__viewer-wrap">
        <p class="dashboard__section-title">Pieza</p>
        <div id="stl-viewer-root"></div>
      </div>

      <div class="dashboard__chat-wrap">
        <p class="dashboard__section-title">Mensajes</p>
        <div id="chat-root"></div>
      </div>

      <div class="dashboard__status-wrap">
        <!-- Hueco que llena WS-4 Fernando. Debe existir y quedar vacío. -->
        <div id="status-bar"></div>
      </div>
    </div>`;

  root.querySelector<HTMLButtonElement>('#ver-lab')!.addEventListener('click', () => {
    deps.showView('lab');
  });

  const viewerRoot = root.querySelector<HTMLElement>('#stl-viewer-root')!;
  const viewer = mountStlViewer(viewerRoot);

  const chatRoot = root.querySelector<HTMLElement>('#chat-root')!;
  // El adjunto del chat es también lo que el visor muestra (D2+D3 comparten un solo control).
  mountChat(chatRoot, deps, (file) => {
    if (file) viewer.showFile(file);
    else viewer.clear();
  });
}
