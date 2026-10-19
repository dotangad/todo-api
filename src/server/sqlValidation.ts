import type { Database } from 'bun:sqlite'
import { parseStmtOrThrow, traverse } from 'sqlite3-parser'

const readableTables = new Set(['todos', 'tags', 'todo_tags'])
// Deliberately omit extension/file I/O functions and allocation-heavy helpers.
const functions = new Set(
  `abs avg ceil ceiling char coalesce concat concat_ws count date datetime
   floor glob group_concat hex ifnull iif instr julianday length like lower
   ltrim max min nullif replace round rtrim sign strftime string_agg substr
   substring sum time timediff total trim typeof unicode unixepoch upper
   json json_array json_array_length json_extract json_object json_quote
   json_remove json_replace json_set json_type json_valid row_number rank
   dense_rank lag lead first_value last_value nth_value ntile`.split(/\s+/),
)

/** Validate the complete SQLite AST; never execute a partially parsed script. */
export function validateSql(db: Database, query: string) {
  const { root } = parseStmtOrThrow(query)
  if (
    root.type !== 'SelectStmt' &&
    root.type !== 'InsertStmt' &&
    root.type !== 'UpdateStmt' &&
    root.type !== 'DeleteStmt'
  )
    throw new Error('Only SELECT, INSERT, UPDATE, and DELETE are supported.')

  const schema = db.prepare<{ name: string }, []>(
    'SELECT name FROM sqlite_schema UNION SELECT name FROM sqlite_temp_schema',
  )
  let schemaNames: Set<string>
  try {
    schemaNames = new Set(schema.all().map((row) => row.name.toLowerCase()))
  } finally {
    schema.finalize()
  }
  const ctes = new Map<string, Set<string>>()
  traverse(root, {
    nodes: {
      With(node) {
        // Bun exposes no progress handler: fail closed on unbounded recursion.
        if (node.recursive) throw new Error('Recursive CTEs are not supported.')
      },
      CommonTableExpr(node) {
        const name = node.tblName.text.toLowerCase()
        if (
          schemaNames.has(name) ||
          /^(sqlite_|pragma_)/.test(name) ||
          ctes.has(name)
        )
          throw new Error(
            'CTE names must be unique and must not shadow database objects.',
          )
        const dependencies = new Set<string>()
        traverse(node.select, {
          nodes: {
            QualifiedName(ref) {
              if (!ref.dbName) dependencies.add(ref.objName.text.toLowerCase())
            },
          },
        })
        ctes.set(name, dependencies)
      },
    },
  })
  // SQLite permits recursive CTEs even without the RECURSIVE keyword.
  const checked = new Set<string>()
  function checkRecursion(name: string, path = new Set<string>()) {
    if (path.has(name)) throw new Error('Recursive CTEs are not supported.')
    if (checked.has(name)) return
    path.add(name)
    for (const dependency of ctes.get(name) ?? []) {
      if (ctes.has(dependency)) checkRecursion(dependency, path)
    }
    path.delete(name)
    checked.add(name)
  }
  for (const name of ctes.keys()) checkRecursion(name)

  const scopes: Set<string>[] = []
  traverse(root, {
    enter(node) {
      if ('with' in node && node.with)
        scopes.push(
          new Set(node.with.ctes.map((cte) => cte.tblName.text.toLowerCase())),
        )
      switch (node.type) {
        case 'InsertStmt':
        case 'UpdateStmt':
        case 'DeleteStmt':
          if (
            node !== root ||
            node.tblName.objName.text.toLowerCase() !== 'todos'
          )
            throw new Error('Writes may only target todos.')
          if ('orConflict' in node && node.orConflict === 'Rollback')
            throw new Error('OR ROLLBACK is not supported.')
          break
        case 'QualifiedName': {
          const name = node.objName.text.toLowerCase()
          const schema = node.dbName?.text.toLowerCase()
          if (
            (schema && schema !== 'main') ||
            (!readableTables.has(name) &&
              !(!schema && scopes.some((scope) => scope.has(name))))
          )
            throw new Error(
              'Reads may only access todos, tags, todo_tags, and CTEs.',
            )
          break
        }
        case 'TableCallSelectTable':
          throw new Error('Table-valued functions are not supported.')
        case 'InTableExpr':
          if (node.args !== undefined)
            throw new Error('Table-valued functions are not supported.')
          break
        case 'FunctionCallExpr':
        case 'FunctionCallStarExpr':
          if (!functions.has(node.name.name.toLowerCase()))
            throw new Error(`Unsupported SQL function: ${node.name.name}`)
          break
        case 'RaiseExpr':
          throw new Error('RAISE is not supported.')
        case 'VariableExpr':
          if (!/^\?(?:[1-9]\d*)?$/.test(node.name))
            throw new Error('Use positional ? parameters only.')
          break
      }
    },
    leave(node) {
      if ('with' in node && node.with) scopes.pop()
    },
  })
  return root.type !== 'SelectStmt'
}
