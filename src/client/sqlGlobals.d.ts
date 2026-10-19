import type { SqlParameter, SqlResult } from '../sqlTypes'

declare global {
  interface Window {
    sql: (query: string, params?: SqlParameter[]) => Promise<SqlResult>
    sqlUndo: () => Promise<SqlResult>
  }
}
