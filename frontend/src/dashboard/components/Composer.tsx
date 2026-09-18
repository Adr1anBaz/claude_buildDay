// WS-1 · Daniela — Barra de entrada inferior (§3.C): adjuntar .stl, escribir y enviar juntos.
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { INPUT_HINTS } from '../config';
import { useCanSend, useLab } from '../state/LabProvider';
import { IconClip, IconSend } from './Icons';

export function Composer() {
  const { file, selectFile, send, connected } = useLab();
  const { locked, reason } = useCanSend();
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const puedeEnviar = Boolean(file) && text.trim().length > 0 && !locked;

  function onPick(e: ChangeEvent<HTMLInputElement>): void {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.stl')) {
      setFileError(`${picked.name} no es un archivo .stl.`);
      return;
    }
    setFileError(null);
    selectFile(picked); // seleccionar NO envía nada al agente (§4)
  }

  async function enviar(): Promise<void> {
    if (!puedeEnviar) return;
    const enviado = text;
    const ok = await send(enviado);
    // Solo se limpia si el backend aceptó: si falla, el usuario conserva su texto (§5).
    if (ok) setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  const placeholder = !connected
    ? INPUT_HINTS.desconectado
    : reason === 'agente'
      ? INPUT_HINTS.pensando
      : reason === 'orden'
        ? INPUT_HINTS.ordenActiva
        : !file
          ? INPUT_HINTS.sinArchivo
          : INPUT_HINTS.listo;

  return (
    <div className="composer">
      {fileError && <p className="composer__error">{fileError}</p>}
      {reason === 'orden' && <p className="composer__hint">{INPUT_HINTS.ordenActiva}</p>}

      <div className={`composer__bar${locked ? ' composer__bar--locked' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          accept=".stl,model/stl"
          onChange={onPick}
          hidden
        />
        <button
          className="iconbtn"
          onClick={() => inputRef.current?.click()}
          disabled={locked}
          aria-label="Adjuntar archivo STL"
          title="Adjuntar archivo .stl"
        >
          <IconClip />
        </button>

        <div className="composer__field">
          {file && <span className="composer__chip" title={file.name}>{file.name}</span>}
          <textarea
            className="composer__input"
            rows={1}
            value={text}
            placeholder={placeholder}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        <button
          className="btn btn--send"
          onClick={() => void enviar()}
          disabled={!puedeEnviar}
          title={locked ? placeholder : 'Enviar la solicitud al operador'}
        >
          {reason === 'agente' ? 'Pensando…' : 'Enviar'}
          <IconSend />
        </button>
      </div>
    </div>
  );
}
