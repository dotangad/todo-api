import { dateKey } from './dates'
import type { Todo } from './types'

export function scheduledForDay(todos: Todo[], day: string) {
  return todos.filter((todo) => todo.scheduleDate === day)
}

export function recordedOnDay<T>(
  items: T[],
  day: string,
  timestamp: (item: T) => string,
) {
  return items.filter((item) => dateKey(new Date(timestamp(item))) === day)
}
