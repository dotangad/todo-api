import { errorMessage, saving, todos } from './state'
import type { Todo, TodoChanges, TodoInput } from './types'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message ?? 'Request failed.')
  return body as T
}

// Keep writes serialized and refresh from the server after each successful change.
// Callers get a success flag so failed saves don't close dialogs or clear drafts.
async function mutate(path: string, method: string, body?: TodoChanges) {
  if (saving.value) return false
  saving.value = true
  errorMessage.value = ''
  try {
    await api(path, { method, body: body ? JSON.stringify(body) : undefined })
    todos.value = await api<Todo[]>('/api/todos?includeSubtodos=true')
    return true
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not save.'
    return false
  } finally {
    saving.value = false
  }
}

export function createTodo(input: TodoInput) {
  return mutate('/api/todos', 'POST', input)
}

export function updateTodo(id: string, changes: TodoChanges) {
  return mutate(`/api/todos/${id}`, 'PATCH', changes)
}

export function deleteTodo(id: string) {
  return mutate(`/api/todos/${id}`, 'DELETE')
}
