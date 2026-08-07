import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: 'src/content/index.ts', formats: ['es'], fileName: () => 'content.js' },
    minify: false,
    target: 'es2022',
  },
});
