import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue()
  ],
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'), // 确保 opencv.js / brushify.js 被复制
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/vue/') ||
            id.includes('/vue-i18n/') ||
            id.includes('/element-plus/') ||
            id.includes('/@element-plus/')
          ) return 'vendor-framework'
          if (id.includes('/fabric/')) return 'vendor-canvas'
          if (
            id.includes('/jspdf/') ||
            id.includes('/html2canvas/') ||
            id.includes('/jszip/') ||
            id.includes('/ag-psd/')
          ) return 'vendor-export'
          return 'vendor'
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['opencv.js','brushify.js']
  },
  server: {
    port: 3000
  }
})
