import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const apiPort = process.env.API_PORT || process.env.PORT || '3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue')) return 'vue'
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': `http://localhost:${apiPort}`
    }
  }
})
