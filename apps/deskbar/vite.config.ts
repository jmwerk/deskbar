/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bridgething, daemonProxy } from './scripts/bridgething.ts';

// Daemon serves the bundle from its own root, not a domain root, so asset paths must be relative.
export default defineConfig(async () => ({
  base: './',
  // Preact ships a far smaller runtime to the device; tests stay on React because Testing Library's CJS build
  // requires react-dom directly, past any alias.
  plugins: [process.env.VITEST ? react() : preact(), tailwindcss(), bridgething()],
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    proxy: await daemonProxy(),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
}));
