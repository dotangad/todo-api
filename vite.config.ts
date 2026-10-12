import devServer from '@hono/vite-dev-server'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  plugins: [
    tailwindcss(),
    devServer({ entry: 'src/index.tsx', injectClientScript: false }),
  ],
  build: {
    outDir: 'public',
    emptyOutDir: true,
    manifest: true,
    rolldownOptions: { input: ['src/client/main.ts', 'src/client/focus.tsx'] },
  },
})
