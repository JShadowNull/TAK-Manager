import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'maskable-icon-512x512.png'],
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,json}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'TAK Manager',
        short_name: 'TAK Manager',
        description: 'A modular application for managing TAK Server instances',
        theme_color: 'hsl(0 0% 100%)',
        background_color: 'hsl(0 0% 100%)',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['utilities', 'productivity'],
        scope: '/',
        start_url: '/?source=pwa',
        prefer_related_applications: false,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ] as any,
  root: '.',
  build: {
    outDir: 'build',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase chunk size limit to 1000kb
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
          ]
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.FRONTEND_PORT as string), 
    allowedHosts: ['takserver-dev'],
    proxy: {
      '/api': `http://127.0.0.1:${process.env.BACKEND_PORT}`,
      '/stream': `http://127.0.0.1:${process.env.BACKEND_PORT}`,
    }
  }
}) 