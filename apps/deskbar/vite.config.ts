/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bridgething, daemonProxy } from './scripts/bridgething.ts';

// Daemon serves the bundle from its own root, not a domain root, so asset paths must be relative.
export default defineConfig(async () => ({
  base: './',
  plugins: [react(), tailwindcss(), bridgething()],
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
