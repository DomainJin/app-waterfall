import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer (React) config. Electron loads either the dev server URL
// (VITE_DEV_SERVER_URL) or the built ./dist/index.html via file://,
// so base must be relative for the production load to resolve assets.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
