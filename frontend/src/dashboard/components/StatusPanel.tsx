// WS-1 · Daniela — Estado resumido del laboratorio (§6.A). Todo sale del bus: nada ficticio.
import { useMemo } from 'react';
import { SIN_INFO } from '../config';
import { buildSummary } from '../services/labAdapter';
import { transportLabel } from '../services/orderService';
import { useLab } from '../state/LabProvider';

export function StatusPanel() {
  const { state, order, agentBusy, connected } = useLab();
  const rows = useMemo(() => buildSummary(state, order, agentBusy), [state, order, agentBusy]);

  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <p className="eyebrow">Telemetría</p>
          <h2>Estado del sistema</h2>
        </div>
      </header>

      {!connected && (
        <p className="notice notice--error">
          Sin conexión con el laboratorio. Lo que ves es lo último que se recibió, no el estado actual.
        </p>
      )}
      {connected && !state && (
        <p className="notice notice--warn">Conectado, esperando el primer estado del laboratorio.</p>
      )}

      <dl className="summary">
        {rows.map((r) => (
          <div className={`summary__row summary__row--${r.tone}`} key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value || SIN_INFO}</dd>
          </div>
        ))}
      </dl>

      <footer className="panel__foot">
        <span>Canal de estado: WebSocket <code>/ws</code></span>
        <span>Envío de órdenes: <code>{transportLabel()}</code></span>
      </footer>
    </section>
  );
}
