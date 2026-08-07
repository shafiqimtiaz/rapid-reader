import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'options.html',
      output: { entryFileNames: 'options.js', chunkFileNames: 'options-[hash].js', assetFileNames: 'options-[hash][extname]' },
    },
  },
});
