import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  // `@/` is the shadcn/ui convention for imports from src.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Well above 5173+, which other local Vite projects take first.
    port: 15173,
    // In development the API and socket live on the Fastify server.
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'ws://localhost:3000', ws: true },
    },
  },
})
