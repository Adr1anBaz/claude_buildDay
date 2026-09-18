// WS-1 · Daniela — Conversación con el operador (§5). Vista principal del dashboard.
// Las líneas del laboratorio y del operador SOLO llegan por el bus (D-14): aquí no se inventa nada.
import { useEffect, useRef } from 'react';
import { useLab } from '../state/LabProvider';
import type { ChatAuthor } from '../types';

const AUTHOR: Record<ChatAuthor, string> = {
  usuario: 'Tú',
  lab: 'Laboratorio',
  operador: 'Operador',
  sistema: 'Sistema',
};

function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ChatView() {
  const { chat, agentBusy, order } = useLab();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, agentBusy]);

  return (
    <div className="chat">
      {chat.length === 0 && (
        <div className="chat__empty">
          <h1>Solicita la fabricación de una pieza</h1>
          <p>
            Adjunta el archivo <code>.stl</code> y describe la pieza, cómo funciona y para qué la vas a
            usar. El operador elegirá la impresora y el preset.
          </p>
        </div>
      )}

      <ol className="chat__list">
        {chat.map((m) => (
          <li key={m.id} className={`msg msg--${m.author}${m.error ? ' msg--error' : ''}`}>
            <div className="msg__meta">
              <span className="msg__author">{AUTHOR[m.author]}</span>
              <span className="msg__time">{hora(m.ts)}</span>
            </div>
            <p className="msg__text">{m.text}</p>
            {m.file && <p className="msg__file">{m.file}</p>}
          </li>
        ))}

        {agentBusy && (
          <li className="msg msg--operador msg--thinking">
            <div className="msg__meta"><span className="msg__author">Operador</span></div>
            <p className="msg__text">
              <span className="dots"><i /><i /><i /></span>
              Pensando…
            </p>
          </li>
        )}
      </ol>

      {order.status === 'lista' && order.drawer && (
        <p className="notice notice--ok">
          Tu pieza está lista para recoger en el cajón {order.drawer.slice(-1)}.
        </p>
      )}

      <div ref={endRef} />
    </div>
  );
}
