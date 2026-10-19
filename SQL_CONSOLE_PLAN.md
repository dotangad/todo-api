# Browser SQL console — implementation plan

## Goal and interface

Expose these functions on the main todos page, in development and production, exclusively for manual browser-console use. No application component, UI action, or normal app workflow may call `sql()` or `sqlUndo()` or use the SQL endpoint. Existing app operations must continue using the existing REST API.

```js
await sql('SELECT * FROM todos ORDER BY created_at DESC')
await sql("UPDATE todos SET completed = 1 WHERE schedule_date < '2026-01-01' RETURNING id, title, completed")
await sqlUndo()
```

- `sql(query, params?)` executes against the real server-side SQLite database, not a browser copy. Optional parameters are positional JSON scalar values.
- Print returned rows with `console.table`. For writes without `RETURNING`, print a one-row summary containing the affected-row count. Also return a structured result to the caller.
- Re-fetch todos after every executed query, including SELECT, and after undo. Attempt refresh after query errors too. Preserve filters, view, URL state, and editor drafts.
- Reject failed calls with useful errors. Clearly distinguish “query committed, refresh failed” from “query failed”; never automatically retry a write.
- `sqlUndo()` reverses the last successful query that actually changed data. Reads, failed queries, and no-op writes do not replace that undo point. One undo level; no redo.

## Existing integration points

- `src/client/main.ts`: main-page entry and HMR cleanup.
- `src/client/actions.ts`: existing API helper, `saving` guard, and todo refresh.
- `src/client/state.ts`: `todos` signal drives the UI and derived tags.
- `src/server/database.ts`: exported Bun SQLite connection and synchronous transaction helper.
- `src/index.tsx`: Hono API routes and `{ error: { message } }` response convention.
- `vite.config.ts`: production code splitting already supported; no browser SQL/WASM dependency is necessary.

## 1. Lazy browser integration

Add `src/client/sqlConsole.ts` for request handling, console rendering, and undo-token state. Add global TypeScript declarations for `window.sql` and `window.sqlUndo`.

Install only tiny global wrappers from `main.ts`; this registration is the app's only integration with the console helper. Both wrappers dynamically import the same module when manually called from the browser console. Do not invoke them from app code, import the console implementation statically, or preload it at startup. Handle HMR cleanup so globals do not retain stale handlers.

Refactor `actions.ts` just enough to share the existing API and refresh helpers. Coordinate SQL/undo with the existing `saving` guard: reject overlapping operations explicitly rather than silently skipping them. Hold the guard through the refresh, and release it in `finally`. Keep SQL-specific code in the lazy module. Existing CRUD behavior must remain unchanged.

## 2. Scoped server execution

Add `src/server/sqlConsole.ts` and routes:

- `POST /api/sql` with `{ query, params? }`.
- `POST /api/sql/undo` with `{ undoToken }`.

Suggested result: `{ rows, changes, undoToken }`, with `undoToken: null` when no current undo point is available. Undo returns a similar summary.

V1 supports one SELECT, INSERT, UPDATE, or DELETE statement per call, including useful CTE and RETURNING forms. Writes target `todos`; reads may join `tags` and `todo_tags`. Reject schema changes, transaction control, PRAGMA, ATTACH/DETACH, extension loading, writes to unrelated tables, and multiple statements. Do not silently execute just the first statement.

Use real SQL-aware validation/SQLite authorization, not a keyword-prefix regex or semicolon splitting. Verify available Bun SQLite capabilities before choosing the mechanism; if needed, use a server-only SQLite-compatible parser with a conservative AST allowlist. Fail closed for unsupported syntax and functions with side effects. Add explicit query/body/result limits and tests for bypass cases.

Treat this as a privileged tool for the existing single-user installation. Require JSON and reject cross-origin browser requests using an explicit trusted-origin policy compatible with localhost development and the documented Tailscale deployment. Do not enable permissive CORS. These checks are not authentication: document that the service must remain privately accessible or receive proper authentication before public exposure.

Execute each operation synchronously within a short transaction. Never keep a transaction open between browser requests. Finalize prepared statements, avoid an unbounded cache of ad hoc SQL, and ensure results are JSON-serializable before committing.

### Raw SQL semantics

Use physical SQLite names (`schedule_date`, `parent_id`, etc.) and integer completion values (`0`/`1`). Tags live in separate tables.

This is raw SQL: the application-level `updateTodo()` behavior is not automatically invoked. In particular, shared-field propagation and `updated_at` changes must be explicit in the query. Document this prominently. SQLite constraints still apply; additionally reject parent cycles before committing, because existing recursive todo rendering assumes an acyclic hierarchy.

## 3. Atomic, conflict-safe undo

For this small database, use before/after snapshots of the todo-related tables rather than attempting to invert arbitrary SQL:

1. In the query transaction, capture canonical snapshots of `todos`, `tags`, and `todo_tags`.
2. Execute the query once, collect results, and capture the after-state.
3. If data changed, commit and publish a new undo record containing both snapshots and a random token. Replace the old record only after successful commit.
4. For undo, begin a transaction, validate the token, and compare current todo-related state with the stored after-state. Return `409 Conflict` if it differs: never overwrite later UI, API, or other-tab edits.
5. Restore the before-state atomically in foreign-key-safe order, restoring descendants and tag associations deleted by cascades. If deferred constraints are needed, keep them transaction-scoped; do not disable foreign-key enforcement globally.
6. Clear the undo record only after restoration commits. A repeated undo reports that nothing is available.

Keep one server-side in-memory undo record for v1. Tokens prevent a stale tab from undoing a newer query. Undo availability does not survive a server restart or browser reload; document that limitation. SELECT responses must not hand another caller a token created by a write; retain tokens locally only from that caller's successful writes.

Do not snapshot or restore the whole SQLite database. Focus timer state/history must remain untouched. Currently focus IDs are stored as JSON, not cascading foreign keys; include a regression test confirming undo leaves focus tables unchanged.

## 4. Tests and verification

Add isolated server tests using an in-memory or temporary database, never the developer's `todos.sqlite`. Prefer injecting a database into the SQL service.

Cover:

- SELECT, bound parameters, bulk UPDATE, INSERT, DELETE, CTEs, RETURNING, and affected-row summaries.
- Failed queries roll back and retain the previous undo point.
- Reads/no-ops preserve undo; a second successful write replaces it.
- Undo restores exact values, timestamps, descendants, and tag links.
- Stale tokens, repeated undo, restart/no-record behavior, and intervening CRUD/focus completion edits.
- Rejected schema/transaction/unrelated-table commands, multi-statements, comments/quoted semicolons, malicious function calls, cycles, and bad requests/origins.
- Client `console.table` output, todo refresh after queries and undo, refresh failures after commits, and overlapping operations.

Run `bun test`, `bun run typecheck`, `bun run check`, and `bun run build`.

Inspect the Vite output/manifest and browser Network panel: the SQL console implementation must be in a separate dynamic chunk, not downloaded until the first `sql()` or `sqlUndo()` call. Manually verify a bulk update changes the rendered todos immediately and undo restores them.

## 5. Documentation

Update `README.md` with console examples, supported SQL scope, physical schema notes, RETURNING usage, explicit timestamp/descendant handling, undo/conflict semantics, and private-access requirements. No new visible UI is required, and `/focus` integration is out of scope for v1.
