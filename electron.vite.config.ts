import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    // El proceso de voz es un archivo aparte (lo lanza utilityProcess).
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts'), voiceWorker: resolve('src/main/voice/worker.ts') } } }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react()]
  }
})
