import { readFileSync } from 'node:fs'
import type { Manifest } from 'vite'

export type ClientEntry = 'src/client/main.ts'

export function assets(entryName: ClientEntry = 'src/client/main.ts') {
  if (process.env.NODE_ENV !== 'production')
    return { scripts: ['/@vite/client', `/${entryName}`], css: [] }
  const manifest = JSON.parse(
    readFileSync(
      new URL('../../public/.vite/manifest.json', import.meta.url),
      'utf8',
    ),
  ) as Manifest
  const entry = manifest[entryName]
  if (!entry) throw new Error(`Missing build entry: ${entryName}`)
  const css = new Set<string>()
  const visited = new Set<string>()
  function includeStyles(name: string) {
    if (visited.has(name)) return
    visited.add(name)
    const asset = manifest[name]
    if (!asset) return
    for (const file of asset.css ?? []) css.add(`/${file}`)
    for (const imported of asset.imports ?? []) includeStyles(imported)
  }
  includeStyles(entryName)
  return {
    scripts: [`/${entry.file}`],
    css: [...css],
  }
}
