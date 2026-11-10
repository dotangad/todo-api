import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('existing plain-text databases migrate without data loss and reopen with rich text intact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'notes-migration-'))
  const path = join(directory, 'todos.sqlite')
  try {
    const db = new Database(path)
    db.exec(`create table notes (
      id text primary key, title text not null, content text not null,
      color text not null, schedule_date text, created_at text not null, updated_at text not null
    )`)
    db.query('insert into notes values (?, ?, ?, ?, ?, ?, ?)').run(
      'legacy',
      'Old note',
      '<b>Literal</b>\nSecond line',
      'yellow',
      '2026-10-13',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    )
    db.close()
    const run = (script: string) => {
      const result = Bun.spawnSync([process.execPath, '--eval', script], {
        cwd: process.cwd(),
        env: { ...process.env, TODO_DATABASE_PATH: path },
      })
      expect(result.stderr.toString()).toBe('')
      expect(result.exitCode).toBe(0)
      return JSON.parse(result.stdout.toString())
    }
    const migrated = run(
      `const { default: app } = await import('./src/index'); console.log(JSON.stringify(await (await app.request('/api/notes/legacy')).json()))`,
    )
    expect(migrated).toMatchObject({
      content: '<b>Literal</b>\nSecond line',
      contentHtml: null,
      color: 'yellow',
      scheduleDate: '2026-10-13',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const edited = run(
      `const { default: app } = await import('./src/index'); console.log(JSON.stringify(await (await app.request('/api/notes/legacy', { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({contentHtml:'<p><strong>Formatted</strong></p>'}) })).json()))`,
    )
    expect(edited.contentHtml).toBe('<p><strong>Formatted</strong></p>')
    const reopened = run(
      `const { default: app } = await import('./src/index'); console.log(JSON.stringify(await (await app.request('/api/notes/legacy')).json()))`,
    )
    expect(reopened).toEqual(edited)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
