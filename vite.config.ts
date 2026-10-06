import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local dev, /api/* can optionally be proxied to `wrangler pages dev` on :8788.
// When wrangler is not running, proxy errors are handled cleanly without terminal spam.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Local worker not running' }));
            }
          });
        },
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
