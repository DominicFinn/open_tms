import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-presentations-index',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/presentations') {
            res.statusCode = 301
            res.setHeader('Location', '/presentations/')
            res.end()
            return
          }
          if (req.url === '/presentations/') {
            req.url = '/presentations/index.html'
          }
          next()
        })
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
})
