// WS-1 · Daniela — Logs técnicos (§6.B). Cada línea es un evento que el servidor reportó de verdad.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../state/LabProvider';

function sello(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function LogsPanel() {
  const { logs } = useLab();
  const [soloAvisos, setSoloAvisos] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const visibles = useMemo(
    () => (soloAvisos ? logs.filter((l) => l.level === 'warn' || l.level === 'error') : logs),
    [logs, soloAvisos],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [visibles.length]);

  return (
    <section className="panel panel--logs">
      <header className="panel__head">
        <div>
          <p className="eyebrow">Diagnóstico</p>
          <h2>Logs técnicos</h2>
        </div>
        <label className="switch">
          <input type="checkbox" checked={soloAvisos} onChange={(e) => setSoloAvisos(e.target.checked)} />
          Solo avisos y errores
        </label>
      </header>

      {visibles.length === 0 ? (
        <p className="notice">Todavía no hay eventos. Aparecerán en cuanto el laboratorio reporte algo.</p>
      ) : (
        <ol className="logs">
          {visibles.map((l) => (
            <li key={l.id} className={`logline logline--${l.level}`}>
              <span className="logline__ts">{sello(l.ts)}</span>
              <span className="logline__src">{l.source}</span>
              <span className="logline__lvl">{l.level}</span>
              <span className="logline__msg">{l.message}</span>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />
      <footer className="panel__foot">
        <span>{logs.length} evento(s) recibidos en esta sesión</span>
        <span>
          Se derivan de los mensajes <code>state</code>, <code>chat</code>, <code>job_started</code> y{' '}
          <code>reset</code> del bus
        </span>
      </footer>
    </section>
  );
}
