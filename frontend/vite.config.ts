import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.FRONTEND_PORT) || 3000,
    strictPort: true,
    proxy: {
      '/ws': {
        target: `ws://localhost:${Number(process.env.BACKEND_PORT) || 8765}`,
        ws: true,
      },
      '/api/admin': {
        target: `http://localhost:${Number(process.env.ADMIN_PORT) || 8766}`,
      },
    },
  },
})
