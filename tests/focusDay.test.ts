import { expect, test } from 'bun:test'
import { recordedOnDay, scheduledForDay } from '../src/client/focusDay'
import type { Todo } from '../src/client/types'

test('the picker only lists tasks scheduled for the local day', () => {
  const tasks = [
    { id: 'today', scheduleDate: '2026-01-02' },
    { id: 'yesterday', scheduleDate: '2026-01-01' },
    { id: 'unscheduled', scheduleDate: null },
  ] as Todo[]
  expect(scheduledForDay(tasks, '2026-01-02').map((task) => task.id)).toEqual([
    'today',
  ])
})

test('events and sessions are filtered by their local calendar day', () => {
  const entries = [
    { id: 'before', at: new Date(2026, 0, 1, 23, 59).toISOString() },
    { id: 'today', at: new Date(2026, 0, 2, 0, 1).toISOString() },
    { id: 'after', at: new Date(2026, 0, 3, 0, 1).toISOString() },
  ]
  expect(recordedOnDay(entries, '2026-01-02', (entry) => entry.at)).toEqual([
    entries[1],
  ])
})
