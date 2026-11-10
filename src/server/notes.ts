import { Hono } from 'hono'
import { type Note, type NoteInput, noteColors } from '../noteTypes'
import { db } from './database'
import { noteHtmlText, sanitizeNoteHtml } from './noteHtml'

db.exec(`create table if not exists notes (
  id text primary key,
  title text not null default '',
  content text not null default '',
  color text not null default 'default',
  schedule_date text,
  created_at text not null,
  updated_at text not null
);
create index if not exists notes_updated_at on notes(updated_at desc);`)

const noteColumns = db.query('pragma table_info(notes)').all() as {
  name: string
}[]
if (!noteColumns.some((column) => column.name === 'content_html'))
  db.exec('alter table notes add column content_html text')

const columns = `id, title, content, content_html as contentHtml, color, schedule_date as scheduleDate,
  created_at as createdAt, updated_at as updatedAt`

export function listNotes() {
  return db
    .query(
      `select ${columns} from notes order by updated_at desc, created_at desc, id desc`,
    )
    .all() as Note[]
}

function getNote(id: string) {
  return db
    .query(`select ${columns} from notes where id = ?`)
    .get(id) as Note | null
}

// Keep edit order unambiguous even when multiple writes share a millisecond.
function nextEditTime() {
  const latest = db
    .query('select updated_at from notes order by updated_at desc limit 1')
    .get() as { updated_at: string } | null
  return new Date(
    Math.max(Date.now(), latest ? Date.parse(latest.updated_at) + 1 : 0),
  ).toISOString()
}

function parseNote(body: unknown, existing?: Note): NoteInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new Error('JSON object is required.')
  const raw = body as Record<string, unknown>
  const input: NoteInput = existing
    ? {
        title: existing.title,
        content: existing.content,
        contentHtml: existing.contentHtml ?? null,
        color: existing.color,
        scheduleDate: existing.scheduleDate,
      }
    : {
        title: '',
        content: '',
        contentHtml: null,
        color: 'default',
        scheduleDate: null,
      }
  for (const field of ['title', 'content'] as const) {
    if (raw[field] !== undefined) {
      if (typeof raw[field] !== 'string')
        throw new Error(`${field} must be a string.`)
      input[field] = raw[field]
    }
  }
  if (raw.contentHtml !== undefined) {
    if (raw.contentHtml !== null && typeof raw.contentHtml !== 'string')
      throw new Error('contentHtml must be a string or null.')
    input.contentHtml =
      raw.contentHtml === null ? null : sanitizeNoteHtml(raw.contentHtml)
    // HTML is authoritative; never trust a conflicting plain-text fallback.
    if (input.contentHtml !== null)
      input.content = noteHtmlText(input.contentHtml)
  } else if (raw.content !== undefined) {
    // Older clients replacing plain text must not leave stale formatting behind.
    input.contentHtml = null
  }
  if (!input.title.trim() && !input.content.trim())
    throw new Error('A note needs a title or content.')
  if (raw.color !== undefined) {
    if (!noteColors.includes(raw.color as NoteInput['color']))
      throw new Error('Invalid note color.')
    input.color = raw.color as NoteInput['color']
  }
  if (raw.scheduleDate !== undefined) {
    const date = raw.scheduleDate
    if (
      date !== null &&
      (typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new Error('scheduleDate must be a valid YYYY-MM-DD date or null.')
    input.scheduleDate = date as string | null
  }
  return input
}

export function createNoteRoutes() {
  const routes = new Hono()
  const invalid = (message: string) => ({ error: { message } })
  routes.get('/', (c) => c.json(listNotes()))
  routes.get('/:id', (c) => {
    const note = getNote(c.req.param('id'))
    return note ? c.json(note) : c.json(invalid('Note not found.'), 404)
  })
  routes.post('/', async (c) => {
    try {
      const input = parseNote(await c.req.json().catch(() => null))
      const id = crypto.randomUUID()
      const now = nextEditTime()
      db.query(`insert into notes (id, title, content, content_html, color, schedule_date, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        input.title,
        input.content,
        input.contentHtml ?? null,
        input.color,
        input.scheduleDate,
        now,
        now,
      )
      return c.json(getNote(id), 201)
    } catch (error) {
      return c.json(
        invalid(error instanceof Error ? error.message : 'Invalid note.'),
        400,
      )
    }
  })
  routes.patch('/:id', async (c) => {
    const body = await c.req.json().catch(() => null)
    const existing = getNote(c.req.param('id'))
    if (!existing) return c.json(invalid('Note not found.'), 404)
    try {
      const input = parseNote(body, existing)
      if (
        Object.entries(input).some(
          ([key, value]) => existing[key as keyof NoteInput] !== value,
        )
      ) {
        const now = nextEditTime()
        db.query(
          `update notes set title = ?, content = ?, content_html = ?, color = ?, schedule_date = ?, updated_at = ? where id = ?`,
        ).run(
          input.title,
          input.content,
          input.contentHtml ?? null,
          input.color,
          input.scheduleDate,
          now,
          existing.id,
        )
      }
      return c.json(getNote(existing.id))
    } catch (error) {
      return c.json(
        invalid(error instanceof Error ? error.message : 'Invalid note.'),
        400,
      )
    }
  })
  routes.delete('/:id', (c) =>
    db.query('delete from notes where id = ?').run(c.req.param('id')).changes
      ? c.body(null, 204)
      : c.json(invalid('Note not found.'), 404),
  )
  return routes
}
