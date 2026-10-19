import { afterEach, beforeEach, expect, test } from 'bun:test'
import { sql, sqlUndo } from '../src/client/sqlConsole'
import { errorMessage, saving, todos } from '../src/client/state'

const originalFetch = globalThis.fetch
const originalTable = console.table
let requests: { path: string; body: unknown }[]
let tables: unknown[]
const freshTodos = [
  {
    id: 'fresh',
    title: 'Fresh',
    completed: false,
    parentId: null,
    tags: [],
    subtodos: [],
  },
]

beforeEach(() => {
  saving.value = false
  errorMessage.value = ''
  todos.value = []
  requests = []
  tables = []
  console.table = (value) => {
    tables.push(value)
  }
})
afterEach(() => {
  globalThis.fetch = originalFetch
  console.table = originalTable
})

function mock(
  handler: (path: string, body: unknown) => Response | Promise<Response>,
) {
  globalThis.fetch = (async (input, options) => {
    const path = String(input)
    const body = options?.body ? JSON.parse(String(options.body)) : undefined
    requests.push({ path, body })
    return handler(path, body)
  }) as typeof fetch
}

const queryResult = (rows: unknown[] = [], undoToken: string | null = null) =>
  Response.json({ rows, changes: 3, undoToken })

test('undo rejects before this console session has a write', async () => {
  await expect(sqlUndo()).rejects.toThrow('No SQL query to undo')
})

test('prints SELECT results and re-fetches todos', async () => {
  mock((path) =>
    path === '/api/sql'
      ? queryResult([{ title: 'Raw' }])
      : Response.json(freshTodos),
  )
  const result = await sql('SELECT title FROM todos WHERE completed=?', [false])
  expect(result.rows).toEqual([{ title: 'Raw' }])
  expect(tables).toEqual([[{ title: 'Raw' }]])
  expect(requests).toEqual([
    {
      path: '/api/sql',
      body: {
        query: 'SELECT title FROM todos WHERE completed=?',
        params: [false],
      },
    },
    { path: '/api/todos?includeSubtodos=true', body: undefined },
  ])
  expect(todos.value).toEqual(freshTodos)
  expect(saving.value).toBe(false)
})

test('prints write summaries, retains token across reads, and refreshes after undo', async () => {
  mock((path, body) => {
    if (path === '/api/todos?includeSubtodos=true')
      return Response.json(freshTodos)
    if (path === '/api/sql/undo') {
      expect(body).toEqual({ undoToken: 'my-write' })
      return queryResult()
    }
    return queryResult(
      [],
      (body as { query: string }).query.startsWith('UPDATE')
        ? 'my-write'
        : null,
    )
  })
  await sql('UPDATE todos SET completed=1')
  await sql('SELECT * FROM todos')
  await sqlUndo()
  expect(tables[0]).toEqual([{ changes: 3 }])
  expect(
    requests.filter(({ path }) => path.includes('includeSubtodos')),
  ).toHaveLength(3)
  await expect(sqlUndo()).rejects.toThrow('No SQL query to undo')
})

test('failed queries still refresh, release the lock, and preserve undo', async () => {
  mock((path) =>
    path === '/api/todos?includeSubtodos=true'
      ? Response.json(freshTodos)
      : queryResult([], 'prior'),
  )
  await sql('UPDATE todos SET completed=1')
  mock((path) =>
    path === '/api/sql'
      ? Response.json({ error: { message: 'Bad query' } }, { status: 400 })
      : path === '/api/sql/undo'
        ? queryResult()
        : Response.json(freshTodos),
  )
  await expect(sql('invalid')).rejects.toThrow('Bad query')
  expect(todos.value).toEqual(freshTodos)
  expect(errorMessage.value).toContain('Bad query')
  expect(saving.value).toBe(false)
  await sqlUndo()
  expect(requests.find(({ path }) => path === '/api/sql/undo')?.body).toEqual({
    undoToken: 'prior',
  })
})

test('successful writes with failed refresh are not retried and remain undoable', async () => {
  mock((path) =>
    path === '/api/sql'
      ? queryResult([], 'committed')
      : Promise.reject(new Error('Offline')),
  )
  await expect(sql('UPDATE todos SET completed=1')).rejects.toThrow(
    'query succeeded, but refreshing todos failed',
  )
  expect(requests.filter(({ path }) => path === '/api/sql')).toHaveLength(1)
  expect(saving.value).toBe(false)
  mock((path) =>
    path === '/api/sql/undo' ? queryResult() : Response.json(freshTodos),
  )
  await sqlUndo()
  expect(requests.find(({ path }) => path === '/api/sql/undo')?.body).toEqual({
    undoToken: 'committed',
  })
})

test('rejects overlapping SQL and UI operations through the shared saving guard', async () => {
  saving.value = true
  await expect(sql('SELECT 1')).rejects.toThrow('in progress')
  expect(requests).toHaveLength(0)
  saving.value = false
  let release: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  mock(async (path) => {
    await pending
    return path === '/api/sql' ? queryResult() : Response.json(freshTodos)
  })
  const first = sql('SELECT 1')
  await expect(sql('SELECT 2')).rejects.toThrow('in progress')
  expect(saving.value).toBe(true)
  release?.()
  await first
  expect(saving.value).toBe(false)
})
