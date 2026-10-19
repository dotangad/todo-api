export type SqlParameter = string | number | boolean | null

export type SqlResult = {
  rows: Record<string, unknown>[]
  changes: number
  // Only a data-changing query returns a token. Reads never disclose one.
  undoToken: string | null
}
