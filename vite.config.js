import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
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
      input: resolve(__dirname, 'src/index.html')
    }
  },
  optimizeDeps: {
    exclude: ['opencv.js','brushify.js']
  },
  server: {
    port: 3000
  }
})