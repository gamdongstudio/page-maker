import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

/*
 * '링크로 가져오기' 는 collector 서비스가 대신 페이지를 읽는다.
 * 그 서비스가 쓰는 자리(포트)는 collector.config.json 한 곳에서만 관리한다.
 * 예전에는 이 파일에 번호를 그대로 적어둬서, 다른 프로그램과 자리가 부딪혔을 때
 * 고칠 곳이 여러 군데였다.
 */
const collectorPort = JSON.parse(
  readFileSync(new URL('./collector.config.json', import.meta.url), 'utf8'),
).port as number

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: `http://127.0.0.1:${collectorPort}`, changeOrigin: true },
    },
  },
})
