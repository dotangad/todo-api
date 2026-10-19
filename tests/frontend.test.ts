import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createTodo, deleteTodo, updateTodo } from '../src/client/actions'
import { dateKey, weekDays } from '../src/client/dates'
import {
  boardWeek,
  clearFilters,
  editorId,
  errorMessage,
  findTodo,
  flatTodos,
  saving,
  sortMode,
  statusMode,
  tagFilter,
  tagMatch,
  tags,
  todos,
  visibleTodos,
} from '../src/client/state'
import type { Todo } from '../src/client/types'

const originalFetch = globalThis.fetch

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    title: id,
    description: null,
    completed: false,
    parentId: null,
    scheduleDate: null,
    scheduleTime: null,
    dueDate: null,
    dueTime: null,
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  todos.value = []
  boardWeek.value = null
  clearFilters()
  errorMessage.value = ''
  saving.value = false
  editorId.value = null
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('frontend state', () => {
  test('shows only root todos, while keeping nested subtasks available for editing', () => {
    const grandchild = todo('grandchild', { parentId: 'child' })
    const child = todo('child', {
      parentId: 'parent',
      tags: ['child-only'],
      subtodos: [grandchild],
    })
    todos.value = [
      todo('parent', { subtodos: [child], tags: ['work', 'home'] }),
      child,
      grandchild,
    ]
    expect(flatTodos.value.map((item) => item.id)).toEqual([
      'parent',
      'child',
      'grandchild',
    ])
    expect(findTodo('child')).toEqual(child)
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['parent'])
    expect(tags.value).toEqual(['home', 'work'])
    tagFilter.value = ['child-only']
    expect(visibleTodos.value).toEqual([])
  })

  test('matches all or any selected tags, sorts due dates, and puts missing dates last', () => {
    todos.value = [
      todo('none'),
      todo('early', { dueDate: '2026-01-02', tags: ['work'] }),
      todo('late', { dueDate: '2026-01-03', tags: ['home', 'work'] }),
    ]
    sortMode.value = 'due-asc'
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'early',
      'late',
      'none',
    ])
    sortMode.value = 'due-desc'
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'late',
      'early',
      'none',
    ])
    tagFilter.value = ['home']
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['late'])
    tagFilter.value = ['work', 'home']
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['late'])
    tagMatch.value = 'any'
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['late', 'early'])
    tagFilter.value = []
    expect(visibleTodos.value).toHaveLength(3)
    tagFilter.value = ['home', 'missing']
    tagMatch.value = 'all'
    expect(visibleTodos.value).toEqual([])
    clearFilters()
    expect(tagFilter.value).toEqual([])
    expect(tagMatch.value).toBe('all')
    expect(visibleTodos.value).toHaveLength(3)
    expect(sortMode.value).toBe('created')
  })

  test('filters root todos by completion status alongside tags and resets on clear', () => {
    todos.value = [
      todo('open-work', { tags: ['work'] }),
      todo('done-work', { completed: true, tags: ['work'] }),
      todo('done-home', { completed: true, tags: ['home'] }),
      todo('child', { completed: true, parentId: 'open-work' }),
    ]
    statusMode.value = 'open'
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['open-work'])
    statusMode.value = 'done'
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'done-work',
      'done-home',
    ])
    tagFilter.value = ['work']
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['done-work'])
    boardWeek.value = '2027-01-03'
    clearFilters()
    expect(boardWeek.value).toBe('2027-01-03')
    expect(statusMode.value).toBe('all')
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'open-work',
      'done-work',
      'done-home',
    ])
  })

  test('sorts by scheduled date and time in both directions, with date-only first and missing dates last', () => {
    todos.value = [
      todo('unscheduled', { createdAt: '2026-02-10T00:00:00Z' }),
      todo('afternoon', {
        scheduleDate: '2026-01-03',
        scheduleTime: '14:30:00',
      }),
      todo('later-day', {
        scheduleDate: '2026-01-04',
        scheduleTime: '01:00:00',
      }),
      todo('midnight', {
        scheduleDate: '2026-01-03',
        scheduleTime: '00:00:00',
      }),
      todo('morning', { scheduleDate: '2026-01-03', scheduleTime: '09:15:45' }),
      todo('date-only', { scheduleDate: '2026-01-03' }),
    ]
    sortMode.value = 'schedule-asc'
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'midnight',
      'date-only',
      'morning',
      'afternoon',
      'later-day',
      'unscheduled',
    ])
    sortMode.value = 'schedule-desc'
    expect(visibleTodos.value.map((item) => item.id)).toEqual([
      'later-day',
      'afternoon',
      'morning',
      'midnight',
      'date-only',
      'unscheduled',
    ])
    clearFilters()
    expect(sortMode.value).toBe('created')
  })

  test('defaults to newest first without mutating the source order', () => {
    todos.value = [
      todo('old'),
      todo('new', { createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(visibleTodos.value.map((item) => item.id)).toEqual(['new', 'old'])
    expect(todos.value.map((item) => item.id)).toEqual(['old', 'new'])
  })
})

describe('API actions', () => {
  test('updates, refreshes todos, and leaves editor state alone', async () => {
    const calls: Array<{ path: string; options?: RequestInit }> = []
    globalThis.fetch = (async (path, options) => {
      calls.push({ path: String(path), options })
      return Response.json(
        options?.method === 'PATCH'
          ? todo('parent')
          : [todo('parent', { completed: true })],
      )
    }) as typeof fetch
    editorId.value = 'parent'
    expect(await updateTodo('parent', { completed: true })).toBe(true)
    expect(calls.map((call) => call.path)).toEqual([
      '/api/todos/parent',
      '/api/todos?includeSubtodos=true',
    ])
    expect(JSON.parse(String(calls[0].options?.body))).toEqual({
      completed: true,
    })
    expect(todos.value[0].completed).toBe(true)
    expect(editorId.value).toBe('parent')
    expect(saving.value).toBe(false)
  })

  test('sends schedule and due times on create/update, including explicit clearing', async () => {
    const requests: Array<{ method: string; body: unknown }> = []
    globalThis.fetch = (async (_path, options) => {
      if (options?.method) {
        requests.push({
          method: options.method,
          body: JSON.parse(String(options.body)),
        })
        return Response.json(todo('timed'))
      }
      return Response.json([todo('timed')])
    }) as typeof fetch
    const input = {
      title: 'Timed todo',
      scheduleDate: '2026-10-12',
      scheduleTime: '00:00:00',
      dueDate: '2026-10-13',
      dueTime: '17:30:45',
    }
    expect(await createTodo(input)).toBe(true)
    expect(await updateTodo('timed', { dueTime: '18:15:00' })).toBe(true)
    expect(
      await updateTodo('timed', { scheduleDate: null, scheduleTime: null }),
    ).toBe(true)
    expect(requests).toEqual([
      { method: 'POST', body: input },
      { method: 'PATCH', body: { dueTime: '18:15:00' } },
      { method: 'PATCH', body: { scheduleDate: null, scheduleTime: null } },
    ])
  })

  test('reports API validation errors without closing the editor or losing data', async () => {
    todos.value = [todo('parent')]
    editorId.value = 'new'
    globalThis.fetch = (async () =>
      Response.json(
        { error: { message: 'Invalid date.' } },
        { status: 400 },
      )) as typeof fetch
    expect(await createTodo({ title: 'Draft' })).toBe(false)
    expect(errorMessage.value).toBe('Invalid date.')
    expect(editorId.value).toBe('new')
    expect(todos.value).toHaveLength(1)
    expect(saving.value).toBe(false)
  })

  test('handles network errors', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Offline')
    }) as typeof fetch
    expect(await updateTodo('parent', { completed: true })).toBe(false)
    expect(errorMessage.value).toBe('Offline')
    expect(saving.value).toBe(false)
  })

  test('accepts empty delete responses and refreshes', async () => {
    globalThis.fetch = (async (_path, options) =>
      options?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json([])) as typeof fetch
    expect(await deleteTodo('parent')).toBe(true)
    expect(todos.value).toEqual([])
  })

  test('does not send another mutation while saving', async () => {
    saving.value = true
    globalThis.fetch = (() => {
      throw new Error('Must not fetch')
    }) as typeof fetch
    expect(await createTodo({ title: 'Duplicate' })).toBe(false)
  })
})

test('board shows the local Sunday–Saturday week even when today is Tuesday', () => {
  expect(dateKey(new Date(2026, 0, 2, 0, 30))).toBe('2026-01-02')
  expect(weekDays(new Date(2026, 0, 6, 0, 30))).toEqual([
    '2026-01-04',
    '2026-01-05',
    '2026-01-06',
    '2026-01-07',
    '2026-01-08',
    '2026-01-09',
    '2026-01-10',
  ])
})

test('board week crosses month and year boundaries and starts on Sunday', () => {
  expect(weekDays(new Date(2026, 0, 1))).toEqual([
    '2025-12-28',
    '2025-12-29',
    '2025-12-30',
    '2025-12-31',
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
  ])
  expect(weekDays(new Date(2026, 2, 1))[0]).toBe('2026-03-01')
  expect(weekDays(new Date(2026, 2, 7))[6]).toBe('2026-03-07')
})

test('board week remains seven distinct local days across DST', () => {
  const days = weekDays(new Date(2026, 2, 10))
  expect(days[0]).toBe('2026-03-08')
  expect(days[6]).toBe('2026-03-14')
  expect(new Set(days).size).toBe(7)
})
