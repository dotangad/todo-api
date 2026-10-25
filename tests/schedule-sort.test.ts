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
