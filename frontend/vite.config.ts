import { defineConfig } from 'vite';

// En dev, Vite sirve el frontend en :5173 y reenvía /api y /ws al backend en :8000.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
});
