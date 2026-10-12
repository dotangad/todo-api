import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { fileURLToPath } from 'node:url'
import app from './index'

const hostname = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? '3000')
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.')

const serverApp = new Hono()
serverApp.use('/assets/*', serveStatic({ root: fileURLToPath(new URL('../public', import.meta.url)) }))
serverApp.route('/', app)

const server = Bun.serve({ hostname, port, fetch: serverApp.fetch })
console.log(`Todo API listening on http://${hostname}:${server.port}`)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await server.stop()
    process.exit(0)
  })
}
