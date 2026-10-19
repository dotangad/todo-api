import { batch, computed, signal } from '@preact/signals'
import type { Todo } from './types'

export const todos = signal<Todo[]>([])
export const view = signal<'table' | 'board'>('table')
// Null follows the current week; a date pins the board to a specific Sunday.
export const boardWeek = signal<string | null>(null)
export const tagFilter = signal<string[]>([])
export const tagMatch = signal<'all' | 'any'>('all')
export const sortMode = signal<
  'created' | 'due-asc' | 'due-desc' | 'schedule-asc' | 'schedule-desc'
>('created')
export const statusMode = signal<'open' | 'done' | 'all'>('all')
export const editorId = signal<string | null>(null) // 'new' opens an empty form.
export const deleteId = signal<string | null>(null)
export const saving = signal(false)
export const errorMessage = signal('')

export const flatTodos = computed(() => {
  const result: Todo[] = []
  const seen = new Set<string>()
  function visit(items: Todo[]) {
    for (const todo of items) {
      if (seen.has(todo.id)) continue
      seen.add(todo.id)
      result.push(todo)
      visit(todo.subtodos ?? [])
    }
  }
  visit(todos.value)
  return result
})

export const tags = computed(() =>
  [
    ...new Set(
      flatTodos.value
        .filter((todo) => todo.parentId === null)
        .flatMap((todo) => todo.tags),
    ),
  ].sort(),
)

export const visibleTodos = computed(() =>
  flatTodos.value
    .filter(
      (todo) =>
        todo.parentId === null &&
        (statusMode.value === 'all' ||
          todo.completed === (statusMode.value === 'done')) &&
        (!tagFilter.value.length ||
          (tagMatch.value === 'all'
            ? tagFilter.value.every((tag) => todo.tags.includes(tag))
            : tagFilter.value.some((tag) => todo.tags.includes(tag)))),
    )
    .sort((a, b) => {
      if (
        sortMode.value === 'schedule-asc' ||
        sortMode.value === 'schedule-desc'
      ) {
        // Missing dates always last; a date without a time starts at midnight.
        if (!a.scheduleDate)
          return b.scheduleDate ? 1 : b.createdAt.localeCompare(a.createdAt)
        if (!b.scheduleDate) return -1
        const aKey = `${a.scheduleDate}T${a.scheduleTime ?? '00:00:00'}`
        const bKey = `${b.scheduleDate}T${b.scheduleTime ?? '00:00:00'}`
        const order =
          sortMode.value === 'schedule-asc'
            ? aKey.localeCompare(bKey)
            : bKey.localeCompare(aKey)
        return order || b.createdAt.localeCompare(a.createdAt)
      }
      if (sortMode.value === 'due-asc')
        return (a.dueDate ?? '9999-12-31').localeCompare(
          b.dueDate ?? '9999-12-31',
        )
      if (sortMode.value === 'due-desc')
        return (b.dueDate ?? '').localeCompare(a.dueDate ?? '')
      return b.createdAt.localeCompare(a.createdAt)
    }),
)

export function findTodo(id: string) {
  return flatTodos.value.find((todo) => todo.id === id)
}

export function openEditor(id = 'new') {
  batch(() => {
    errorMessage.value = ''
    editorId.value = id
  })
}

export function clearFilters() {
  batch(() => {
    tagFilter.value = []
    tagMatch.value = 'all'
    sortMode.value = 'created'
    statusMode.value = 'all'
  })
}
