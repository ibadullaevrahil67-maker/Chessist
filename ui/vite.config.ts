import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../engine/bin/Release/net48/ui',
    emptyOutDir: true,
  },
  base: './',
})
