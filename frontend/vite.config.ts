import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { createDevProxyAgent, ensureDevApi, forwardApi } from './devApiProxy.ts'

function apiProxy(): Plugin {
  const agent = createDevProxyAgent()
  return {
    name: 'hdl-dev-api',
    async configureServer(server) {
      await ensureDevApi(server)
      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? '').startsWith('/api')) {
          next()
          return
        }
        forwardApi(req, res, agent)
      })
    },
  }
}

export default defineConfig({
  plugins: [apiProxy(), vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
