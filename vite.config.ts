import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The bundle is served by the on-device daemon from its own root, not a
// domain root, so every asset reference must be relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
