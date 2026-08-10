import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Vite doesn't populate process.env from .env files for the config file
  // itself (only for client-side import.meta.env) - load it explicitly so
  // frontend/.env's VITE_API_URL actually takes effect below.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_PORT || '5173'),
      strictPort: false, // Automatically try next port if in use
      allowedHosts: [
        '.ngrok-free.dev',
        '.ngrok.io',
        '.ngrok.app',
        '.devtunnels.ms',
      ]
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3001')
    }
  }
})
