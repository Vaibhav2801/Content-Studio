import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      testTimeout: 15000,
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': { target: apiProxyTarget, changeOrigin: true },
        '/media': { target: apiProxyTarget, changeOrigin: true },
      },
      allowedHosts: [
        'terminal.local',
        'planner-seeds-addition-emissions.trycloudflare.com',
      ],
    },
    preview: {
      host: '0.0.0.0',
    },
  }
})