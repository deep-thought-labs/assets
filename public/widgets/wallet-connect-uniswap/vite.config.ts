import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'wallet-connect-uniswap.js',
        assetFileNames: 'wallet-connect-uniswap.[ext]',
      },
    },
  },
})
