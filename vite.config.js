import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    // 3D 場館（three.js＋後製）約 1.3 MB，已拆成只在選票區／張數頁載入的獨立檔案
    chunkSizeWarningLimit: 1500,
  },
})
