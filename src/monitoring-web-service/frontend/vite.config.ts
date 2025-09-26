/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Node modules go to vendor chunks
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            // State management
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('@tanstack/react-query')) {
              return 'vendor-state'
            }
            // Charts
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('recharts')) {
              return 'vendor-charts'
            }
            // Forms
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'vendor-forms'
            }
            // Grid layout
            if (id.includes('react-grid-layout') || id.includes('react-resizable')) {
              return 'vendor-grid'
            }
            // UI libraries
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-hot-toast')) {
              return 'vendor-ui'
            }
            // WebSocket
            if (id.includes('socket.io-client')) {
              return 'vendor-websocket'
            }
            // Utilities
            if (id.includes('axios') || id.includes('date-fns') || id.includes('clsx') || id.includes('uuid')) {
              return 'vendor-utils'
            }
            // Other large vendor libraries
            return 'vendor'
          }
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '')
            : 'chunk'
          return `js/[name]-[hash].js`
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
      external: (id) => {
        // Don't bundle development-only dependencies
        if (process.env.NODE_ENV === 'production') {
          return ['@tanstack/react-query-devtools'].includes(id)
        }
        return false
      },
    },
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500, // Warn if chunks exceed 500KB
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      '@tanstack/react-query',
      'axios',
      'clsx',
      'date-fns',
    ],
    exclude: ['@tanstack/react-query-devtools'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/types/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})