import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'tak.svg'
      ],
      manifest: {
        name: 'Tak Manager',
        short_name: 'TakManager',
        description: 'TAK Server Management Application',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  root: path.resolve(__dirname, 'src'),
  publicDir: path.resolve(__dirname, 'src/assets'),
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html')
      },
      output: {
        manualChunks: {
          'chart': ['chart.js', 'chartjs-adapter-date-fns'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'socket': ['socket.io-client']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: parseInt(process.env.VITE_PORT),
    strictPort: true,
    host: true,
    open: false,
    cors: true,
    hmr: {
      port: parseInt(process.env.VITE_PORT),
      host: '0.0.0.0',
      clientPort: parseInt(process.env.VITE_PORT)
    },
    watch: {
      usePolling: true
    }
  }
}); 