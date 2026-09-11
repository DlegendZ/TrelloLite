import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves the demo build from https://<user>.github.io/TrelloLite/
  base: mode === 'demo' ? '/TrelloLite/' : '/',
  server: {
    port: 5173,
  },
}))
