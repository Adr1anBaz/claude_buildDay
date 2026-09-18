import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, Vite sirve el frontend en :5173 y reenvía /api y /ws al backend en :8000.
export default defineConfig({
  // React solo se usa dentro de src/dashboard/ (WS-1); el resto del front sigue en TS puro.
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
});
