import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || 'https://policysetuai.onrender.com'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/webhook': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/test-voice': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/test-voice-upload': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/static/audio': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/demo': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      }
    }
  }
})
