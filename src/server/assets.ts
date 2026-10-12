import { readFileSync } from 'node:fs'
import type { Manifest } from 'vite'

export function assets() {
  if (process.env.NODE_ENV !== 'production') return { scripts: ['/@vite/client', '/src/client/main.ts'], css: [] }
  const manifest = JSON.parse(readFileSync(new URL('../../public/.vite/manifest.json', import.meta.url), 'utf8')) as Manifest
  const entry = manifest['src/client/main.ts']
  return { scripts: [`/${entry.file}`], css: (entry.css ?? []).map(file => `/${file}`) }
}
