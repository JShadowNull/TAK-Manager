import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'build',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT) : 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8989',
      '/stream': 'http://127.0.0.1:8989',
    }
  }
}) 