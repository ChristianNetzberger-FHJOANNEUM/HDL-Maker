import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 5174, strictPort: true },
  // Prebundle MathJax for the browser (dev). Do not exclude — raw CJS paths fail in the client.
  optimizeDeps: {
    include: [
      'mathjax-full/js/mathjax.js',
      'mathjax-full/js/input/tex.js',
      'mathjax-full/js/output/svg.js',
      'mathjax-full/js/adaptors/liteAdaptor.js',
      'mathjax-full/js/handlers/html.js',
      'mathjax-full/js/input/tex/base/BaseConfiguration.js',
      'mathjax-full/js/input/tex/ams/AmsConfiguration.js',
    ],
  },
  build: {
    // Separate chunk when MathJax is requested; plain diagrams stay small.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('mathjax-full')) return 'mathjax'
        },
      },
    },
  },
})
