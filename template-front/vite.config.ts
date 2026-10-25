import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    // Split heavy vendor code out of the initial bundle. Feature code is
    // split automatically by the route-level React.lazy boundaries.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          // Add one entry per heavy, lazily-loaded library (charts, editors, …)
          // so it never lands in the initial bundle.
        },
      },
    },
    // Surface accidental bundle bloat early.
    chunkSizeWarningLimit: 600,
  },
})
