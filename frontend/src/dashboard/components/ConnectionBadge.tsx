// WS-1 · Daniela — Estado de la conexión con el laboratorio.
import { useLab } from '../state/LabProvider';

export function ConnectionBadge() {
  const { connected, state } = useLab();
  const esperando = connected && !state;
  const clase = connected ? (esperando ? 'badge badge--warn' : 'badge badge--ok') : 'badge badge--error';
  const texto = connected ? (esperando ? 'Esperando estado' : 'En línea') : 'Sin conexión';
  return (
    <span className={clase} title={connected ? 'WebSocket /ws conectado' : 'Reintentando la conexión…'}>
      <i className="badge__dot" />
      {texto}
    </span>
  );
}
