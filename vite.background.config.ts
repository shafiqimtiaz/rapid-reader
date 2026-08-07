import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: 'background.ts', formats: ['es'], fileName: () => 'background.js' },
    minify: false,
    target: 'es2022',
  },
});
