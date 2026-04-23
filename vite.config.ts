import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 배포 시에는 기본 경로인 '/'를 사용해야 합니다.
  base: '/',
})