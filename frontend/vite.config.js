import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // เพิ่มคำสั่งนี้เพื่ออนุญาตให้ทุกลิงก์จาก Cloudflare ทะลุเข้ามาได้
    allowedHosts: true
  }
})