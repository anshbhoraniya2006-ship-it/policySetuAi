import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_BASE_URL || 'https://policysetuai.onrender.com'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/webhook': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/test-voice': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/test-voice-upload': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/static/audio': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/demo': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      }
    }
  }
})
