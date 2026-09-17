// Cambio entre las dos vistas (WS-0). No hay router: solo se muestra una y se esconde la otra.
import type { ViewName } from './contracts';

export function createViews(onShow?: (v: ViewName) => void) {
  const dashboard = document.getElementById('dashboard-root');
  const lab = document.getElementById('lab-root');
  if (!dashboard || !lab) throw new Error('Faltan #dashboard-root o #lab-root en index.html');

  let current: ViewName = 'dashboard';

  function showView(v: ViewName): void {
    current = v;
    dashboard!.hidden = v !== 'dashboard';
    lab!.hidden = v !== 'lab';
    onShow?.(v);
  }

  return { dashboard, lab, showView, current: () => current };
}
