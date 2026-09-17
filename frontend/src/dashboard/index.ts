// WS-1 · Daniela — Dashboard. Tareas D1-D6 en plan.md §7.
// STUB de WS-0: existe para que todo compile. Reemplázalo, pero CONSERVA la firma y el hueco #status-bar.
import type { Deps } from '../contracts';

export function mountDashboard(root: HTMLElement, deps: Deps): void {
  root.innerHTML = `
    <div style="max-width:720px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:16px;min-height:100vh">
      <button id="ver-lab" style="align-self:flex-start;padding:8px 16px">Ver laboratorio</button>
      <p style="opacity:.6;margin:0">WS-1 · Daniela: visualizador STL y mensajes van aquí (D1-D6).</p>
      <div style="flex:1"></div>
      <!-- Hueco que llena WS-4 Fernando. Debe existir y quedar vacío. -->
      <div id="status-bar"></div>
    </div>`;
  root.querySelector<HTMLButtonElement>('#ver-lab')!.addEventListener('click', () => deps.showView('lab'));
}
