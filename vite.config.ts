import { defineConfig } from 'vite'
import devServer from '@hono/vite-dev-server'

export default defineConfig({
  publicDir: false,
  plugins: [devServer({ entry: 'src/index.tsx', injectClientScript: false })],
  build: {
    outDir: 'public',
    emptyOutDir: true,
    manifest: true,
    rolldownOptions: { input: 'src/client/main.ts' },
  },
})
