// WS-1 · Daniela — Chat (tareas D3-D4 de plan.md §7).
// Adjuntar · texto · Enviar. El mensaje del usuario se pinta al instante; las líneas
// del laboratorio y del operador SOLO se pintan desde deps.bus.onChat (D-14), nunca
// desde la respuesta del POST /api/chat.
import type { ChatMsg, Deps } from '../contracts';

export type AttachChangeHandler = (file: File | null) => void;

type LineKind = 'user' | 'lab' | 'operador' | 'error';

const WHO_LABEL: Record<LineKind, string> = {
  user: 'Tú',
  lab: 'Laboratorio',
  operador: 'Operador',
  error: 'Error',
};

/** Monta el chat dentro de `container`. `onAttachChange` avisa al visor STL cuando cambia el adjunto. */
export function mountChat(container: HTMLElement, deps: Deps, onAttachChange?: AttachChangeHandler): void {
  container.classList.add('chat');

  const log = document.createElement('div');
  log.className = 'chat__log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');

  const empty = document.createElement('p');
  empty.className = 'chat__empty';
  empty.textContent = 'Cuéntale al operador qué necesitas imprimir. Puedes adjuntar el .stl primero.';
  log.appendChild(empty);

  const composer = document.createElement('form');
  composer.className = 'chat__composer';
  composer.noValidate = true;

  const attachLabel = document.createElement('label');
  attachLabel.className = 'chat__attach';
  attachLabel.title = 'Adjuntar archivo';
  const attachInput = document.createElement('input');
  attachInput.type = 'file';
  attachInput.accept = '.stl';
  attachInput.className = 'chat__attach-input';
  attachInput.setAttribute('aria-label', 'Adjuntar archivo');
  const attachIcon = document.createElement('span');
  attachIcon.className = 'chat__attach-icon';
  attachIcon.textContent = '📎';
  attachIcon.setAttribute('aria-hidden', 'true');
  attachLabel.append(attachIcon, attachInput);

  const attachedTag = document.createElement('span');
  attachedTag.className = 'chat__attached-tag';
  attachedTag.hidden = true;

  const removeAttachedBtn = document.createElement('button');
  removeAttachedBtn.type = 'button';
  removeAttachedBtn.className = 'chat__attached-remove';
  removeAttachedBtn.textContent = '×';
  removeAttachedBtn.hidden = true;
  removeAttachedBtn.title = 'Quitar archivo adjunto';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'chat__text';
  textInput.placeholder = 'Escribe tu mensaje… (ej. "4 motores, 250 mm")';
  textInput.autocomplete = 'off';
  textInput.setAttribute('aria-label', 'Mensaje');

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'chat__send btn-primary';
  sendBtn.textContent = 'Enviar';

  composer.append(attachLabel, attachedTag, removeAttachedBtn, textInput, sendBtn);
  container.append(log, composer);

  let attachedFile: File | null = null;

  function setAttached(file: File | null): void {
    attachedFile = file;
    attachedTag.hidden = !file;
    removeAttachedBtn.hidden = !file;
    attachedTag.textContent = file ? `📎 ${file.name}` : '';
    onAttachChange?.(file);
  }

  attachInput.addEventListener('change', () => {
    const file = attachInput.files?.[0] ?? null;
    setAttached(file);
  });

  removeAttachedBtn.addEventListener('click', () => {
    attachInput.value = '';
    setAttached(null);
  });

  function appendLine(kind: LineKind, text: string): void {
    empty.hidden = true;
    const line = document.createElement('div');
    line.className = `chat__line chat__line--${kind}`;
    const who = document.createElement('span');
    who.className = 'chat__who';
    who.textContent = WHO_LABEL[kind];
    const body = document.createElement('span');
    body.className = 'chat__body';
    body.textContent = text;
    line.append(who, body);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy: boolean): void {
    textInput.disabled = busy;
    sendBtn.disabled = busy;
    attachInput.disabled = busy;
    removeAttachedBtn.disabled = busy;
    sendBtn.textContent = busy ? 'pensando…' : 'Enviar';
  }

  let busy = false;

  composer.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (busy) return;
    const text = textInput.value.trim();
    if (!text) return;

    appendLine('user', attachedFile ? `${text}  (adjunto: ${attachedFile.name})` : text);

    const fileName = attachedFile?.name ?? null;
    textInput.value = '';
    busy = true;
    setBusy(true);

    deps.api
      .chat(text, fileName)
      .then((result) => {
        // D-14: las líneas de 'lab'/'operador' llegan solo por deps.bus.onChat.
        // Aquí solo reaccionamos a un rechazo explícito del servidor.
        if (!result.ok) {
          appendLine('error', result.reply || 'El operador no pudo atender la orden.');
        }
      })
      .catch((err: unknown) => {
        console.error('[dashboard] fallo de red en /api/chat', err);
        appendLine('error', 'No pude hablar con el operador. Revisa la conexión.');
      })
      .finally(() => {
        busy = false;
        setBusy(false);
        textInput.focus();
      });
  });

  deps.bus.onChat((m: ChatMsg) => {
    appendLine(m.from, m.text);
  });

  deps.bus.onReset(() => {
    log.innerHTML = '';
    log.appendChild(empty);
    empty.hidden = false;
  });
}
