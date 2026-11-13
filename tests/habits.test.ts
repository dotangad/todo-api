import { afterEach, expect, test } from 'bun:test'
import type { VNode } from 'preact'
import { HabitTable } from '../src/client/components/HabitsPage'
import {
  createHabit,
  deleteHabit,
  habitError,
  habitSaving,
  habits,
  monthDays,
  renameHabit,
  setHabitCompletion,
  shiftMonth,
} from '../src/client/habits'
import { type Habit, isHabitDate } from '../src/habitTypes'

const originalFetch = globalThis.fetch
const habit = (changes: Partial<Habit> = {}): Habit => ({
  id: 'read',
  title: 'Read daily',
  createdAt: '2026-01-01T00:00:00Z',
  logs: [],
  ...changes,
})
afterEach(() => {
  globalThis.fetch = originalFetch
  habits.value = []
  habitSaving.value = false
  habitError.value = ''
})

test('calendar dates handle leap years, month boundaries, and invalid dates', () => {
  expect(monthDays('2024-02')).toHaveLength(29)
  expect(monthDays('2025-02')).toHaveLength(28)
  expect(monthDays('2026-11')).toHaveLength(30)
  expect(monthDays('2026-03')).toHaveLength(31)
  expect(monthDays('2026-03')[30]).toBe('2026-03-31')
  expect(monthDays('2026-13')).toEqual([])
  expect(monthDays('invalid')).toEqual([])
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  expect(shiftMonth('0001-01', -1)).toBe('0001-01')
  expect(shiftMonth('9999-12', 1)).toBe('9999-12')
  expect(isHabitDate('2025-02-29')).toBe(false)
  expect(isHabitDate('2024-02-29')).toBe(true)
})

test('creation, rename, log/unlog, and deletion update data from one response per write', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (path, options) => {
    calls.push(`${options?.method} ${path}`)
    if (String(path).includes('/logs/'))
      return Response.json(
        habit({
          title: 'Read a book',
          logs: options?.method === 'PUT' ? ['2026-11-01'] : [],
        }),
      )
    if (options?.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json(habit(JSON.parse(String(options?.body))))
  }) as typeof fetch
  expect(await createHabit('Read daily')).toBe(true)
  expect(habits.value).toEqual([habit()])
  expect(await renameHabit('read', 'Read a book')).toBe(true)
  expect(habits.value[0].title).toBe('Read a book')
  expect(await setHabitCompletion('read', '2026-11-01', true)).toBe(true)
  expect(habits.value[0].logs).toEqual(['2026-11-01'])
  expect(await setHabitCompletion('read', '2026-11-01', false)).toBe(true)
  expect(habits.value[0].logs).toEqual([])
  expect(await deleteHabit('read')).toBe(true)
  expect(habits.value).toEqual([])
  expect(calls).toEqual([
    'POST /api/habits',
    'PATCH /api/habits/read',
    'PUT /api/habits/read/logs/2026-11-01',
    'DELETE /api/habits/read/logs/2026-11-01',
    'DELETE /api/habits/read',
  ])
})

test('failed writes preserve saved data and release the guard; concurrent writes are blocked', async () => {
  habits.value = [habit()]
  globalThis.fetch = (async () =>
    Response.json(
      { error: { message: 'Invalid date.' } },
      { status: 400 },
    )) as typeof fetch
  expect(await setHabitCompletion('read', 'bad', true)).toBe(false)
  expect(habits.value).toEqual([habit()])
  expect(habitError.value).toBe('Invalid date.')
  expect(habitSaving.value).toBe(false)
  globalThis.fetch = (async () => {
    throw new Error('Offline')
  }) as typeof fetch
  expect(await deleteHabit('read')).toBe(false)
  expect(habitError.value).toBe('Offline')
  expect(habits.value).toHaveLength(1)
  habitSaving.value = true
  globalThis.fetch = (() => {
    throw new Error('Must not fetch')
  }) as typeof fetch
  expect(await createHabit('Blocked')).toBe(false)
  expect(habitError.value).toBe('Offline')
})

function nodes(tree: unknown): VNode<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object' || !('type' in tree)) return []
  const node = tree as VNode<Record<string, unknown>>
  return [node, ...nodes(node.props.children)]
}

test('completion grid shows the selected month, counts only its logs, and toggles via accessible buttons', async () => {
  habits.value = [habit({ logs: ['2026-10-31', '2026-11-01'] })]
  const tree = nodes(
    HabitTable({ month: '2026-11', today: '2026-11-02', onEdit() {} }),
  )
  const cells = tree.filter((node) => 'aria-pressed' in node.props)
  expect(cells).toHaveLength(30)
  expect(cells[0].props['aria-pressed']).toBe(true)
  expect(cells[1].props['aria-pressed']).toBe(false)
  expect(cells[0].props['aria-label']).toBe('Read daily, 2026-11-01')
  expect(
    tree.find((node) => node.props.class === 'habit-total')?.props.children,
  ).toBe(1)
  expect(
    tree.filter((node) => node.props['aria-current'] === 'date'),
  ).toHaveLength(1)
  globalThis.fetch = (async (path, options) => {
    expect(String(path)).toBe('/api/habits/read/logs/2026-11-01')
    expect(options?.method).toBe('DELETE')
    return Response.json(habit({ logs: ['2026-10-31'] }))
  }) as typeof fetch
  ;(cells[0].props.onClick as () => void)()
  await Bun.sleep(0)
  expect(habits.value[0].logs).toEqual(['2026-10-31'])
})
