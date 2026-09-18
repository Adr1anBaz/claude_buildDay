// WS-1 · Daniela — Envío de la orden de fabricación. Única puerta de salida del dashboard.
// Los componentes visuales no saben si esto viaja como JSON o como multipart.
import type { ApiClient, ChatResult } from '../../contracts';
import { ORDER_TRANSPORT, UPLOAD_FIELDS, UPLOAD_URL } from '../config';

export interface SubmitOrder {
  text: string;
  file: File;
}

export interface SubmitOutcome {
  /** true solo si el BACKEND confirmó que aceptó la orden. Nunca se asume. */
  accepted: boolean;
  /** Respuesta del operador, si vino en el cuerpo. Las líneas del chat llegan por el bus (D-14). */
  reply: string;
  /** Mensaje para el usuario cuando `accepted` es false. */
  error?: string;
}

/** Transporte A — contrato vigente del equipo (plan.md §5.3). Solo viaja `file.name` (D-13). */
async function sendAsJson(api: ApiClient, order: SubmitOrder): Promise<SubmitOutcome> {
  const res: ChatResult = await api.chat(order.text, order.file.name);
  return res.ok
    ? { accepted: true, reply: res.reply }
    : { accepted: false, reply: res.reply, error: res.reply };
}

/**
 * Transporte B — `multipart/form-data` con el archivo completo (§13.A).
 * Solo se usa si `VITE_UPLOAD_URL` está definida: el endpoint todavía no existe en el backend.
 */
async function sendAsMultipart(order: SubmitOrder, url: string): Promise<SubmitOutcome> {
  const form = new FormData();
  form.append(UPLOAD_FIELDS.file, order.file, order.file.name);
  form.append(UPLOAD_FIELDS.text, order.text);

  const res = await fetch(url, { method: 'POST', body: form });
  if (res.status === 429) {
    return { accepted: false, reply: '', error: 'El operador está atendiendo otra orden. Espera un momento.' };
  }
  if (!res.ok) {
    return { accepted: false, reply: '', error: `El laboratorio rechazó la orden (${res.status}).` };
  }
  // El cuerpo aún no tiene contrato: se acepta `{ok, reply}` y si no viene, basta el 200.
  const body = (await res.json().catch(() => null)) as Partial<ChatResult> | null;
  if (body && body.ok === false) {
    const reply = body.reply ?? 'El operador no pudo tomar la orden.';
    return { accepted: false, reply, error: reply };
  }
  return { accepted: true, reply: body?.reply ?? '' };
}

/** Envía archivo + explicación juntos. Nunca lanza: siempre devuelve un resultado que la UI sabe pintar. */
export async function submitOrder(api: ApiClient, order: SubmitOrder): Promise<SubmitOutcome> {
  try {
    return ORDER_TRANSPORT === 'multipart' && UPLOAD_URL
      ? await sendAsMultipart(order, UPLOAD_URL)
      : await sendAsJson(api, order);
  } catch (err) {
    console.error('[orden] falló el envío', err);
    return {
      accepted: false,
      reply: '',
      error: 'No pude enviar la orden. Revisa la conexión y vuelve a intentarlo.',
    };
  }
}

/** Para mostrar en el panel de estado de dónde va a salir la orden. */
export function transportLabel(): string {
  return ORDER_TRANSPORT === 'multipart' ? `multipart → ${UPLOAD_URL}` : 'JSON → /api/chat';
}
