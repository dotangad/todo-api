import type { Database, SQLQueryBindings } from 'bun:sqlite'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { SqlResult } from '../sqlTypes'
import { validateSql } from './sqlValidation'

const MAX_QUERY = 32_768
const MAX_ROWS = 10_000
const MAX_BYTES = 2_000_000
const tables = ['todos', 'tags', 'todo_tags'] as const
type Row = Record<string, SQLQueryBindings>
type Snapshot = Record<(typeof tables)[number], Row[]>
type Undo = { token: string; before: Snapshot; after: string; changes: number }

class SqlError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400,
  ) {
    super(message)
  }
}

function checkSize(value: unknown) {
  const json = JSON.stringify(value)
  if (Buffer.byteLength(json) > MAX_BYTES)
    throw new SqlError('SQL result or undo snapshot exceeds the 2 MB limit.')
  return json
}

/** One record per server process; no transaction is held between requests. */
export function createSqlConsole(db: Database) {
  let undo: Undo | undefined

  function collect(iterator: IterableIterator<Row>): Row[] {
    const rows: Row[] = []
    let bytes = 2
    for (const row of iterator) {
      if (rows.length === MAX_ROWS)
        throw new SqlError('SQL row limit is 10000.')
      bytes += Buffer.byteLength(JSON.stringify(row)) + 1
      if (bytes > MAX_BYTES)
        throw new SqlError(
          'SQL result or undo snapshot exceeds the 2 MB limit.',
        )
      rows.push(row)
    }
    return rows
  }

  function all(query: string, params: SQLQueryBindings[] = []): Row[] {
    const statement = db.prepare<Row, SQLQueryBindings[]>(query)
    try {
      return collect(statement.iterate(...params))
    } finally {
      statement.finalize()
    }
  }

  function snapshot(): Snapshot {
    return {
      todos: all('SELECT * FROM main.todos ORDER BY id'),
      tags: all('SELECT * FROM main.tags ORDER BY id'),
      todo_tags: all('SELECT * FROM main.todo_tags ORDER BY todo_id, tag_id'),
    }
  }

  function atomic<T>(work: () => T): T {
    db.exec('BEGIN IMMEDIATE')
    try {
      const result = work()
      db.exec('COMMIT')
      return result
    } catch (error) {
      if (db.inTransaction) db.exec('ROLLBACK')
      throw error
    }
  }

  function assertValidTodos(rows: Row[]) {
    const parents = new Map<string, string | null>()
    for (const row of rows) {
      // SQLite's flexible typing must not produce values the UI cannot render.
      if (
        typeof row.id !== 'string' ||
        typeof row.title !== 'string' ||
        typeof row.created_at !== 'string' ||
        typeof row.updated_at !== 'string' ||
        (row.completed !== 0 && row.completed !== 1) ||
        [
          'parent_id',
          'description',
          'schedule_date',
          'schedule_time',
          'due_date',
          'due_time',
        ].some((field) => row[field] !== null && typeof row[field] !== 'string')
      )
        throw new SqlError('Todo fields must retain their documented types.')
      parents.set(row.id, row.parent_id as string | null)
    }
    const visited = new Set<string>()
    for (const id of parents.keys()) {
      const path = new Set<string>()
      let current: string | null = id
      while (current !== null && !visited.has(current)) {
        if (path.has(current))
          throw new SqlError('Todo parent cycles are not allowed.')
        path.add(current)
        current = parents.get(current) ?? null
      }
      for (const member of path) visited.add(member)
    }
  }

  return {
    execute(query: unknown, params: unknown = []): SqlResult {
      if (
        typeof query !== 'string' ||
        !query.trim() ||
        query.length > MAX_QUERY
      )
        throw new SqlError(
          'query must be a nonempty string of at most 32768 characters.',
        )
      if (
        !Array.isArray(params) ||
        params.length > 999 ||
        params.some(
          (value) =>
            value !== null &&
            typeof value !== 'string' &&
            !(typeof value === 'number' && Number.isFinite(value)) &&
            typeof value !== 'boolean',
        )
      )
        throw new SqlError(
          'params must contain at most 999 JSON scalar values.',
        )
      const bindings = params.map((value) =>
        typeof value === 'boolean' ? Number(value) : value,
      )
      const write = validateSql(db, query)
      let next: Undo | undefined
      const result = atomic(() => {
        const before = snapshot()
        const beforeJson = checkSize(before)
        const statement = db.prepare<Row, SQLQueryBindings[]>(query)
        let rows: Row[] = []
        let changes = 0
        try {
          if (statement.paramsCount !== bindings.length)
            throw new SqlError('Parameter count does not match the query.')
          if (statement.columnNames.length) {
            rows = collect(statement.iterate(...bindings))
            if (write) changes = Number(all('SELECT changes() AS n')[0].n)
          } else {
            changes = statement.run(...bindings).changes
          }
          // Serialize before commit; a bad result must never leave a committed write.
          rows = JSON.parse(checkSize(rows))
        } finally {
          statement.finalize()
        }
        const after = snapshot()
        assertValidTodos(after.todos)
        const afterJson = checkSize(after)
        if (beforeJson !== afterJson) {
          next = {
            token: crypto.randomUUID(),
            before,
            after: afterJson,
            changes,
          }
        }
        return { rows, changes, undoToken: next?.token ?? null } as SqlResult
      })
      // Publication happens only after COMMIT succeeds.
      if (next) undo = next
      return result
    },

    undo(token: unknown): SqlResult {
      const record = undo
      if (!record)
        throw new SqlError('Nothing to undo (or the server restarted).', 409)
      if (typeof token !== 'string' || token !== record.token)
        throw new SqlError(
          'This undo token is stale or belongs to another query.',
          409,
        )
      const result = atomic(() => {
        if (checkSize(snapshot()) !== record.after)
          throw new SqlError(
            'Todos changed since this query; undo would overwrite later edits.',
            409,
          )
        db.exec('PRAGMA defer_foreign_keys = ON')
        db.exec(
          'DELETE FROM main.todo_tags; DELETE FROM main.todos; DELETE FROM main.tags',
        )
        for (const table of tables) {
          const rows = record.before[table]
          if (!rows.length) continue
          const columns = Object.keys(rows[0])
          const statement = db.prepare(
            `INSERT INTO main.${table} (${columns.map((name) => `"${name}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          )
          try {
            for (const row of rows)
              statement.run(...columns.map((name) => row[name]))
          } finally {
            statement.finalize()
          }
        }
        return { rows: [], changes: record.changes, undoToken: null }
      })
      undo = undefined
      return result
    },
  }
}

/** Explicit trusted origins, not forwarded headers, determine proxy access. */
export function createSqlRoutes(
  db: Database,
  trustedOrigins = process.env.TODO_SQL_TRUSTED_ORIGINS ?? '',
) {
  const service = createSqlConsole(db)
  const trusted = new Set(
    trustedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  const app = new Hono()
  app.use('*', bodyLimit({ maxSize: 65_536 }))
  app.use('*', async (c, next) => {
    const origin = c.req.header('origin')
    const url = new URL(c.req.url)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      !origin ||
      c.req.header('sec-fetch-site') === 'cross-site' ||
      !(trusted.has(origin) || (local && origin === url.origin))
    )
      return c.json(
        {
          error: { message: 'SQL console requires a trusted browser origin.' },
        },
        403,
      )
    if (
      c.req.header('content-type')?.split(';')[0].trim().toLowerCase() !==
      'application/json'
    )
      return c.json(
        { error: { message: 'Content-Type must be application/json.' } },
        415,
      )
    c.header('Cache-Control', 'no-store')
    await next()
  })
  app.post('/', async (c) => {
    try {
      const body = await c.req.json()
      return c.json(service.execute(body?.query, body?.params))
    } catch (error) {
      return c.json(
        {
          error: {
            message:
              error instanceof Error ? error.message : 'Invalid SQL request.',
          },
        },
        error instanceof SqlError ? error.status : 400,
      )
    }
  })
  app.post('/undo', async (c) => {
    try {
      const body = await c.req.json()
      return c.json(service.undo(body?.undoToken))
    } catch (error) {
      return c.json(
        {
          error: {
            message: error instanceof Error ? error.message : 'Could not undo.',
          },
        },
        error instanceof SqlError ? error.status : 400,
      )
    }
  })
  return app
}
