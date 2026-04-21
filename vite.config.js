import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://prod-ai-backend-v2.passionbits.io',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://prod-ai-backend-v2.passionbits.io',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
