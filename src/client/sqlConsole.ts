import type { SqlParameter, SqlResult } from '../sqlTypes'
import { api, refreshTodos } from './actions'
import { errorMessage, saving } from './state'

let undoToken: string | null = null

async function execute(path: string, body: unknown, isUndo: boolean) {
  if (saving.value)
    throw new Error(
      'Another todo operation is in progress. Try again when it finishes.',
    )
  saving.value = true
  errorMessage.value = ''
  let result: SqlResult | undefined
  let queryError: unknown
  let refreshError: unknown
  try {
    try {
      result = await api<SqlResult>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (isUndo) undoToken = null
      else if (result.undoToken) undoToken = result.undoToken
      console.table(
        result.rows.length ? result.rows : [{ changes: result.changes }],
      )
    } catch (error) {
      queryError = error
    }
    // Even failed queries trigger a refresh; never retry the write itself.
    try {
      await refreshTodos()
    } catch (error) {
      refreshError = error
    }
    if (queryError || refreshError) {
      const detail = (error: unknown) =>
        error instanceof Error ? error.message : String(error)
      const message = queryError
        ? `SQL request failed: ${detail(queryError)}${refreshError ? ` Also failed to refresh todos: ${detail(refreshError)}` : ''}`
        : `SQL ${isUndo ? 'undo' : 'query'} succeeded, but refreshing todos failed: ${detail(refreshError)}. Do not repeat the write; refresh the page instead.`
      throw new Error(message)
    }
    return result as SqlResult
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'SQL console request failed.'
    throw error
  } finally {
    saving.value = false
  }
}

/** Manual console API only. Normal app workflows must use the REST actions. */
export function sql(query: string, params: SqlParameter[] = []) {
  return execute('/api/sql', { query, params }, false)
}

export function sqlUndo() {
  if (!undoToken)
    return Promise.reject(
      new Error('No SQL query to undo in this page session.'),
    )
  return execute('/api/sql/undo', { undoToken }, true)
}
