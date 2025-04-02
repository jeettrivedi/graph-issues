import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/graph-issues/', // for GitHub Pages
  build: {
    sourcemap: true,
  }
}) 