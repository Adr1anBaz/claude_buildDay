// WS-1 · Daniela — Barra superior: identidad, conexión y acceso al laboratorio (§3.D).
import { useNavigate } from 'react-router';
import { LAB_ROUTE } from '../config';
import { ConnectionBadge } from './ConnectionBadge';
import { IconLab, IconMenu } from './Icons';

export function TopBar({ onToggleSidebar, sidebarOpen }: { onToggleSidebar(): void; sidebarOpen: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <button
        className="iconbtn"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
      >
        <IconMenu />
      </button>

      <div className="topbar__id">
        <span className="topbar__title">Lab Operador</span>
        <span className="topbar__sub">Centro de control de fabricación</span>
      </div>

      <div className="topbar__right">
        <ConnectionBadge />
        {/* Siempre habilitado: no depende de archivo, orden ni impresión en curso (§7). */}
        <button className="btn btn--primary" onClick={() => navigate(LAB_ROUTE)}>
          <IconLab />
          Ver laboratorio
        </button>
      </div>
    </header>
  );
}
