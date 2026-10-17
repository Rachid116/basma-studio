import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  esbuild: {
    drop: ['console', 'debugger']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/components/admin/')) {
            return 'admin-cms';
          }
          if (id.includes('/src/data/') || id.includes('/src/services/')) {
            return 'store-data';
          }
          if (id.includes('/src/components/sections/')) {
            return 'studio-sections';
          }
        }
      }
    }
  },
  server: {
    port: 8080,
    strictPort: false
  }
});
