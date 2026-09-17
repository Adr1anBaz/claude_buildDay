// Cliente HTTP (WS-0). Contrato en plan.md §5.3.
import type { ApiClient, ChatResult } from '../contracts';

async function post(path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res;
}

export function createApiClient(): ApiClient {
  return {
    async chat(text: string, file: string | null): Promise<ChatResult> {
      try {
        const res = await post('/api/chat', { text, file });
        return (await res.json()) as ChatResult;
      } catch (err) {
        const msg = String(err).includes('429')
          ? 'Ya hay una orden en curso. Espera a que termine.'
          : 'No pude hablar con el operador. Usa el botón Demo.';
        return { ok: false, reply: msg };
      }
    },
    async demo(): Promise<void> {
      await post('/api/demo');
    },
    async reset(): Promise<void> {
      await post('/api/reset');
    },
  };
}
