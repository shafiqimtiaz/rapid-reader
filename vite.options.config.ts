import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'public/options.html',
      output: { entryFileNames: 'options.js', chunkFileNames: 'options-[hash].js', assetFileNames: 'options-[hash][extname]' },
    },
  },
});
