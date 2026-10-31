import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/webhook': 'http://127.0.0.1:8000',
      '/test-voice': 'http://127.0.0.1:8000',
      '/test-voice-upload': 'http://127.0.0.1:8000',
      '/static/audio': 'http://127.0.0.1:8000',
      '/demo': 'http://127.0.0.1:8000',
    }
  }
})
