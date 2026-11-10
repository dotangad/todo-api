import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'todo-sort-'))
const previousPath = process.env.TODO_DATABASE_PATH
process.env.TODO_DATABASE_PATH = join(directory, 'todos.sqlite')
const { default: app } = await import('../src/index')

afterAll(() => {
  if (previousPath === undefined) delete process.env.TODO_DATABASE_PATH
  else process.env.TODO_DATABASE_PATH = previousPath
  rmSync(directory, { recursive: true, force: true })
})

test('API sorts scheduled date and time, with unscheduled todos last in both directions', async () => {
  for (const input of [
    { title: 'unscheduled' },
    {
      title: 'afternoon',
      scheduleDate: '2026-01-03',
      scheduleTime: '14:30:00',
    },
    { title: 'tomorrow', scheduleDate: '2026-01-04', scheduleTime: '01:00:00' },
    { title: 'morning', scheduleDate: '2026-01-03', scheduleTime: '09:15:45' },
    { title: 'date-only', scheduleDate: '2026-01-03' },
  ]) {
    const response = await app.request('/api/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(response.status).toBe(201)
  }

  const titles = async (sort: string) => {
    const response = await app.request(`/api/todos?sort=${sort}`)
    expect(response.status).toBe(200)
    return ((await response.json()) as Array<{ title: string }>).map(
      (todo) => todo.title,
    )
  }

  expect(await titles('schedule-asc')).toEqual([
    'date-only',
    'morning',
    'afternoon',
    'tomorrow',
    'unscheduled',
  ])
  expect(await titles('schedule-desc')).toEqual([
    'tomorrow',
    'afternoon',
    'morning',
    'date-only',
    'unscheduled',
  ])
})

async function request(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('creates subtasks with inherited fields and independent status, updates and clears recursively', async () => {
  const response = await request('POST', '/api/todos', {
    title: 'Parent',
    scheduleDate: '2026-10-13',
    scheduleTime: '09:00',
    dueDate: '2026-10-14',
    dueTime: '12:00',
    tags: ['Work'],
    subtodos: [{ title: 'One', completed: true }, { title: 'Two' }],
  })
  expect(response.status).toBe(201)
  const parent = await response.json()
  expect(parent.completed).toBe(false)
  expect(
    parent.subtodos.map((child: { title: string }) => child.title),
  ).toEqual(['One', 'Two'])
  expect(parent.subtodos[0]).toMatchObject({
    completed: true,
    parentId: parent.id,
    tags: ['work'],
    scheduleDate: '2026-10-13',
    scheduleTime: '09:00:00',
    dueDate: '2026-10-14',
    dueTime: '12:00:00',
  })
  const first = parent.subtodos[0]
  const second = parent.subtodos[1]
  const grandchild = await request('POST', '/api/todos', {
    title: 'Grandchild',
    parentId: first.id,
  })
  expect((await grandchild.json()).tags).toEqual(['work'])

  const updated = await request('PATCH', `/api/todos/${parent.id}`, {
    tags: ['home'],
    scheduleDate: null,
    scheduleTime: null,
    dueDate: '2026-10-15',
    dueTime: null,
    subtodos: [
      { id: first.id, title: 'Renamed', completed: true },
      { title: 'Three' },
    ],
  })
  expect(updated.status).toBe(200)
  const result = await updated.json()
  expect(result.completed).toBe(false)
  expect(
    result.subtodos.map((child: { title: string }) => child.title),
  ).toEqual(['Renamed', 'Three'])
  for (const child of result.subtodos) {
    expect(child).toMatchObject({
      tags: ['home'],
      scheduleDate: null,
      scheduleTime: null,
      dueDate: '2026-10-15',
      dueTime: null,
    })
  }
  expect(result.subtodos[0].completed).toBe(true)
  expect(result.subtodos[1].completed).toBe(false)
  expect(
    (await (await app.request(`/api/todos/${first.id}`)).json()).subtodos[0],
  ).toMatchObject({
    tags: ['home'],
    scheduleDate: null,
    dueDate: '2026-10-15',
  })
  expect((await app.request(`/api/todos/${second.id}`)).status).toBe(404)
})

test('rejects foreign subtask IDs atomically', async () => {
  const first = await (
    await request('POST', '/api/todos', { title: 'First' })
  ).json()
  const second = await (
    await request('POST', '/api/todos', { title: 'Second' })
  ).json()
  const response = await request('PATCH', `/api/todos/${first.id}`, {
    title: 'Changed',
    subtodos: [{ id: second.id, title: 'Stolen' }],
  })
  expect(response.status).toBe(400)
  expect(
    (await (await app.request(`/api/todos/${first.id}`)).json()).title,
  ).toBe('First')
})

test('notes persist independently, sort by last edit, and support assigning and clearing board dates', async () => {
  const firstResponse = await request('POST', '/api/notes', {
    content: '  Keep my formatting\n\nSecond paragraph  ',
    color: 'yellow',
    scheduleDate: '2026-10-13',
  })
  expect(firstResponse.status).toBe(201)
  const first = await firstResponse.json()
  expect(first).toMatchObject({
    title: '',
    content: '  Keep my formatting\n\nSecond paragraph  ',
    color: 'yellow',
    scheduleDate: '2026-10-13',
  })
  const second = await (
    await request('POST', '/api/notes', { title: 'Title only' })
  ).json()
  const { db } = await import('../src/server/database')
  db.query('update notes set updated_at = ? where id = ?').run(
    '2000-01-01T00:00:00.000Z',
    first.id,
  )
  const list = async () =>
    (await (await app.request('/api/notes')).json()) as Array<{ id: string }>
  expect((await list()).map((note) => note.id)).toEqual([second.id, first.id])
  const changed = await request('PATCH', `/api/notes/${first.id}`, {
    title: 'Edited',
    scheduleDate: null,
  })
  expect(changed.status).toBe(200)
  const edited = await changed.json()
  expect(edited).toMatchObject({
    title: 'Edited',
    scheduleDate: null,
    content: first.content,
    color: 'yellow',
    createdAt: first.createdAt,
  })
  expect((await list())[0].id).toBe(first.id)
  const unchanged = await (
    await request('PATCH', `/api/notes/${first.id}`, { title: 'Edited' })
  ).json()
  expect(unchanged.updatedAt).toBe(edited.updatedAt)
  expect(await (await app.request(`/api/notes/${first.id}`)).json()).toEqual(
    edited,
  )
  const todos = await (await app.request('/api/todos')).json()
  expect(todos.some((todo: { id: string }) => todo.id === first.id)).toBe(false)
  expect(
    (await app.request(`/api/notes/${first.id}`, { method: 'DELETE' })).status,
  ).toBe(204)
  expect((await app.request(`/api/notes/${first.id}`)).status).toBe(404)
  expect(
    (await app.request(`/api/notes/${first.id}`, { method: 'DELETE' })).status,
  ).toBe(404)
  expect(
    (await request('PATCH', `/api/notes/${first.id}`, { title: 'Missing' }))
      .status,
  ).toBe(404)
  await app.request(`/api/notes/${second.id}`, { method: 'DELETE' })
})

test('notes reject empty content, malformed bodies, invalid colors, and impossible dates without altering saved data', async () => {
  for (const input of [
    null,
    [],
    {},
    { title: '  ', content: '\n' },
    { title: 42 },
    { title: 'Note', content: null },
    { title: 'Note', color: 'red' },
    ...['2026-02-30', '2026-02-29', '2026-13-01', 'not-a-date', '', 12].map(
      (scheduleDate) => ({ title: 'Note', scheduleDate }),
    ),
  ]) {
    expect((await request('POST', '/api/notes', input)).status).toBe(400)
  }
  const note = await (
    await request('POST', '/api/notes', {
      title: 'Leap day',
      scheduleDate: '2028-02-29',
    })
  ).json()
  expect(
    (await request('PATCH', `/api/notes/${note.id}`, { title: '' })).status,
  ).toBe(400)
  expect(
    (
      await request('PATCH', `/api/notes/${note.id}`, {
        title: 'Changed',
        scheduleDate: '2028-02-30',
      })
    ).status,
  ).toBe(400)
  expect(await (await app.request(`/api/notes/${note.id}`)).json()).toEqual(
    note,
  )
  await app.request(`/api/notes/${note.id}`, { method: 'DELETE' })
})

test('/notes and the board bootstrap stored notes safely', async () => {
  const note = await (
    await request('POST', '/api/notes', {
      content: '</script><script>alert(1)</script>',
      scheduleDate: '2026-10-13',
    })
  ).json()
  for (const path of ['/notes', '/?view=board']) {
    const response = await app.request(path)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('data-initial-notes=')
    expect(html).toContain(note.id)
    expect(html).not.toContain('<script>alert(1)</script>')
    if (path === '/notes') expect(html).toContain('data-page="notes"')
  }
  await app.request(`/api/notes/${note.id}`, { method: 'DELETE' })
})
