// WS-1 · Daniela — Menú lateral (§3.A). Abierto ocupa ~1/4 de la pantalla; se colapsa a iconos.
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { ROUTES } from '../config';
import { useLab } from '../state/LabProvider';
import { IconActivity, IconChat, IconClose, IconCube, IconTerminal } from './Icons';

const ORDER_LABEL: Record<string, string> = {
  'sin-orden': 'Sin orden activa',
  enviando: 'Enviando al operador…',
  activa: 'Orden en proceso',
  lista: 'Pieza lista para recoger',
  rechazada: 'Orden rechazada',
};

export function Sidebar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { file, selectFile, order, logs } = useLab();
  const hayPieza = Boolean(file);

  const item = (to: string, icon: ReactNode, label: string, extra?: string) => (
    <NavLink
      to={to}
      className={({ isActive }) => `navitem${isActive ? ' navitem--active' : ''}`}
      title={label}
    >
      <span className="navitem__icon">{icon}</span>
      <span className="navitem__label">{label}</span>
      {extra && <span className="navitem__extra">{extra}</span>}
    </NavLink>
  );

  return (
    <aside className={`sidebar${open ? '' : ' sidebar--closed'}`}>
      <nav className="sidebar__nav">
        <p className="sidebar__legend">Operación</p>
        {item(ROUTES.chat, <IconChat />, 'Conversación')}
        {item(ROUTES.estado, <IconActivity />, 'Estado del sistema')}
        {item(ROUTES.logs, <IconTerminal />, 'Logs técnicos', logs.length ? String(logs.length) : undefined)}

        <p className="sidebar__legend">Pieza</p>
        {hayPieza ? (
          item(ROUTES.pieza, <IconCube />, 'Visualizar pieza')
        ) : (
          // Deshabilitado hasta que exista un .stl válido (§3.A y §4).
          <span className="navitem navitem--disabled" title="Adjunta un archivo .stl para habilitarlo">
            <span className="navitem__icon"><IconCube /></span>
            <span className="navitem__label">Visualizar pieza</span>
          </span>
        )}
      </nav>

      <div className="sidebar__foot">
        {file && (
          <div className="filecard">
            <p className="filecard__label">Archivo cargado</p>
            <div className="filecard__row">
              <span className="filecard__name" title={file.name}>{file.name}</span>
              <button className="iconbtn iconbtn--sm" onClick={() => selectFile(null)} aria-label="Quitar archivo">
                <IconClose size={14} />
              </button>
            </div>
            <p className="filecard__size">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        )}
        <p className={`orderchip orderchip--${order.status}`}>{ORDER_LABEL[order.status] ?? order.status}</p>
        <button className="sidebar__collapse" onClick={onClose}>Ocultar menú</button>
      </div>
    </aside>
  );
}
