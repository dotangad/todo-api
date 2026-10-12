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

test('focus mode logs start, stop and reset and saves completed todos and subtasks', async () => {
  const parent = await (
    await request('POST', '/api/todos', {
      title: 'Focus parent',
      subtodos: [{ title: 'Focus child' }],
    })
  ).json()
  const child = parent.subtodos[0]
  const focusPage = await app.request('/focus')
  expect(focusPage.status).toBe(200)
  expect(await focusPage.text()).toContain('data-focus-app')
  expect((await app.request('/api/focus')).status).toBe(200)
  expect(
    (await request('PUT', '/api/focus/tasks', { ids: [child.id] })).status,
  ).toBe(400)
  expect(
    (await request('PUT', '/api/focus/tasks', { ids: [parent.id] })).status,
  ).toBe(200)
  expect(
    (
      await request('PATCH', '/api/focus/todos/not-selected', {
        completed: true,
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request('PATCH', `/api/focus/todos/${child.id}`, {
        completed: true,
      })
    ).status,
  ).toBe(200)
  expect(
    (await (await app.request('/api/focus')).json()).completedTodos,
  ).toEqual([])
  expect(
    (await app.request('/api/focus/start', { method: 'POST' })).status,
  ).toBe(200)
  expect(
    (await request('PUT', '/api/focus/tasks', { ids: [parent.id] })).status,
  ).toBe(400)
  expect(
    (await app.request('/api/focus/start', { method: 'POST' })).status,
  ).toBe(400)
  await request('PATCH', `/api/focus/todos/${child.id}`, { completed: false })
  const completed = await request('PATCH', `/api/focus/todos/${child.id}`, {
    completed: true,
  })
  expect((await completed.json()).completedTodos).toEqual([
    { id: child.id, title: child.title },
  ])
  expect(
    (
      await (
        await request('PATCH', `/api/focus/todos/${child.id}`, {
          completed: false,
        })
      ).json()
    ).completedTodos,
  ).toEqual([])
  await request('PATCH', `/api/focus/todos/${child.id}`, { completed: true })
  expect(
    (await app.request('/api/focus/stop', { method: 'POST' })).status,
  ).toBe(200)
  const running = await app.request('/api/focus/start', { method: 'POST' })
  expect((await running.json()).startedAt).toBeTruthy()
  const reset = await app.request('/api/focus/reset', { method: 'POST' })
  expect(reset.status).toBe(200)
  const state = await reset.json()
  expect(state.elapsedMs).toBe(0)
  expect(state.startedAt).toBeNull()
  expect(state.completedTodos).toEqual([])
  expect(state.events.map((event: { kind: string }) => event.kind)).toEqual([
    'reset',
    'stop',
    'start',
    'stop',
    'start',
  ])
  expect(state.sessions[0].completedTodos).toEqual([
    { id: child.id, title: child.title },
  ])
  expect(state.sessions[0].durationMs).toBeGreaterThanOrEqual(0)
  expect(await (await app.request('/api/focus/events')).json()).toHaveLength(5)
  expect(await (await app.request('/api/focus/sessions')).json()).toHaveLength(
    1,
  )
  expect(
    (await app.request('/api/focus/reset', { method: 'POST' })).status,
  ).toBe(400)
})
