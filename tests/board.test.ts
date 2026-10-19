import { afterEach, describe, expect, test } from 'bun:test'
import { Filters } from '../src/client/components/Filters'
import { TodoBoard } from '../src/client/components/TodoBoard'
import { TodoCard } from '../src/client/components/TodoCard'
import { WeekFilter } from '../src/client/components/WeekFilter'
import { shiftWeek, weekDays } from '../src/client/dates'
import { boardWeek, todos, view } from '../src/client/state'
import type { Todo } from '../src/client/types'

type Node = {
  type: unknown
  props: {
    children?: unknown
    onClick?: () => void
    todo?: Todo
    draggable?: boolean
    [key: string]: unknown
  }
}

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object' || !('type' in tree)) return []
  const node = tree as Node
  return [node, ...nodes(node.props.children)]
}

function todo(id: string, changes: Partial<Todo>): Todo {
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
    ...changes,
  }
}

afterEach(() => {
  boardWeek.value = null
  todos.value = []
  view.value = 'table'
})

describe('board week', () => {
  test('shows the week control only for the board view', () => {
    view.value = 'table'
    expect(nodes(Filters()).some((node) => node.type === WeekFilter)).toBe(
      false,
    )
    view.value = 'board'
    expect(nodes(Filters()).some((node) => node.type === WeekFilter)).toBe(true)
    expect(nodes(TodoBoard()).some((node) => node.type === 'nav')).toBe(false)
  })

  test('navigates previous and next weeks and TODAY returns to the current week', () => {
    boardWeek.value = '2027-01-10'
    let nav = nodes(WeekFilter()).find((node) => node.type === 'nav')
    expect(nav?.props['aria-label']).toBe('Board week')
    nodes(nav)
      .find((node) => node.props['aria-label'] === 'Previous week')
      ?.props.onClick()
    expect(boardWeek.value).toBe('2027-01-03')
    nav = nodes(WeekFilter()).find((node) => node.type === 'nav')
    nodes(nav)
      .find((node) => node.props['aria-label'] === 'Next week')
      ?.props.onClick()
    expect(boardWeek.value).toBe('2027-01-10')
    nodes(nav)
      .find((node) => node.props.children === 'TODAY')
      ?.props.onClick()
    expect(boardWeek.value).toBeNull()
    expect(
      nodes(WeekFilter()).find((node) => node.props.children === 'TODAY')?.props
        .disabled,
    ).toBe(true)

    boardWeek.value = shiftWeek(weekDays()[0], -1)
    nodes(WeekFilter())
      .find((node) => node.props['aria-label'] === 'Next week')
      ?.props.onClick()
    expect(boardWeek.value).toBeNull()
  })

  test('renders the selected week, counting due cards and disabling drag only on due-day copies', () => {
    boardWeek.value = '2027-01-03'
    todos.value = [
      todo('two-days', {
        scheduleDate: '2027-01-04',
        dueDate: '2027-01-06',
      }),
      todo('same-day', {
        scheduleDate: '2027-01-06',
        dueDate: '2027-01-06',
      }),
      todo('other-week', { scheduleDate: '2027-01-11' }),
    ]
    const columns = nodes(TodoBoard()).filter(
      (node) => node.type === 'section' && node.props.class === 'day-column',
    )
    expect(columns.map((column) => column.props['data-drop-day'])).toEqual([
      '2027-01-03',
      '2027-01-04',
      '2027-01-05',
      '2027-01-06',
      '2027-01-07',
      '2027-01-08',
      '2027-01-09',
    ])
    const monday = nodes(columns[1]).filter((node) => node.type === TodoCard)
    expect(
      monday.map((card) => [card.props.todo?.id, card.props.draggable]),
    ).toEqual([['two-days', undefined]])
    const wednesday = nodes(columns[3])
    expect(
      wednesday
        .filter((node) => node.type === TodoCard)
        .map((card) => [card.props.todo?.id, card.props.draggable]),
    ).toEqual([
      ['two-days', false],
      ['same-day', false],
    ])
    expect(wednesday.find((node) => node.type === 'span')?.props.children).toBe(
      2,
    )
    expect(
      nodes(TodoBoard()).filter((node) => node.type === TodoCard),
    ).toHaveLength(3)
  })
})
