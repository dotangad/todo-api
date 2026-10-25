# Todo API

Bun + Hono REST API backed by SQLite.

## Run

```bash
bun install
bun run dev
```

The database is created automatically at `todos.sqlite`. Override with `TODO_DATABASE_PATH=/path/to/todos.sqlite`.

## Production deployment

The production app runs as the per-user systemd service `todo-api.service`. It listens only on `127.0.0.1:3011`; Tailscale Serve terminates HTTPS and exposes it to the tailnet at:

```text
https://URL:3011/
```

The service unit is at `~/.config/systemd/user/todo-api.service`. The SQLite database is `todo-api/todos.sqlite` and is ignored by Git.

### Deploy an update

After pulling changes, install dependencies, validate, build the browser bundle, and restart the service:

```bash
cd /home/angad/todo-api
git pull
bun install
bun run typecheck
bun run build
systemctl --user restart todo-api.service
```

Verify the local service and the HTTPS endpoint:

```bash
systemctl --user status todo-api.service
curl -k http://127.0.0.1:3011/healthcheck
tailscale serve status
```

Useful operations:

```bash
journalctl --user -u todo-api.service -f  # Follow logs
systemctl --user restart todo-api.service
systemctl --user stop todo-api.service
systemctl --user start todo-api.service
```

## Code quality

[Biome](https://biomejs.dev/) handles formatting and linting (including import sorting) without ESLint or Prettier:

```bash
bun run check      # Check formatting and lint rules
bun run fix        # Apply formatting and safe fixes
bun run typecheck  # TypeScript checks
```

## Frontend

The browser UI uses **Preact + signals**. Bun/Hono still renders the initial HTML
and serves the JSON API; the client mounts once using the embedded todo data.

- `src/client/state.ts`: global signals for todos, filters, the view, and open dialogs;
  computed signals for flattened todos, tags, and filtered/sorted results.
- `src/client/actions.ts`: API writes, pending/error state, and server refreshes.
- `src/client/components/`: table/rows, board/cards, editor/subtasks, and dialogs.
  `TagFilter` is a multi-select popover; `SortFilter` handles sort order.
- `src/client/useCardDrag.ts`: mouse and touch dragging for board cards.

Components read signals directly and Preact updates the DOM. Form drafts stay in
local component state, so updating a subtask doesn't erase unsaved parent edits.
Editing uses native `<dialog>`; delete confirmation opens a second dialog above
it. Escape closes the top dialog. There is no custom modal stack or portal library.
The view switcher sits beside the status, tag, and sort controls. Select multiple tags in
the popover and use `&` to require every selected tag (the default) or `Ⅱ` to
match any selected tag. With no tags selected, all todos are shown. The Clear
button resets status, tags, match mode, and sort. The view and controls persist in the
URL (`view=board`, repeated `tag=`, `match=any`, `sort=schedule-asc`, `status=open`), so refreshes,
hot reloads, and shared links restore the same state. Defaults are omitted; other
query parameters and the URL fragment are preserved. The board starts on the current
local Sunday–Saturday week; its week switcher (only shown in board view) navigates
back and forward or returns to TODAY. Selected weeks persist as `week=YYYY-MM-DD`
(the week's Sunday) even when switching to table view. The board scrolls horizontally
across the page, independent of the width-constrained header, view switcher, filters,
and table. Day columns have a fixed width; long card titles truncate. Todos with a due
date appear on their due day even if unscheduled; due-day cards cannot be dragged.
Todos with neither a schedule nor a due date remain in the table.
Cards show the optional scheduled time beside the title, with tags on the left
and a red due date on the right when present. Only top-level todos appear in the
table and board; subtasks remain accessible in the parent editor. Press **N**
anywhere outside an input or modal to open a new todo. Click a todo's title to edit it. Schedule and due dates/times can be
edited through the reusable `DateTimePicker` in the table and editor. A compact
label opens a native popover with date and optional time controls (including
seconds). Apply commits both fields together; Cancel, Escape, or clicking outside
discards the picker draft. Clear date also clears its time; Remove time keeps the
date. Changing dates preserves the time. In the editor, Apply only updates the
local draft until the todo is saved. The popover uses the browser's top layer so
it is not clipped by the table or modal. Sort by scheduled date/time (ascending
or descending) from the Sort menu; date-only todos count as midnight, and
unscheduled todos appear last. The API also accepts `sort=schedule-asc` or
`sort=schedule-desc`.

Run `bun test` for state/action tests, `bun run typecheck` for TypeScript, and
`bun run build` for the production bundle. The client uses Preact's JSX runtime;
server views retain Hono's JSX runtime. No React compatibility layer is needed.

### Styling

Tailwind CSS v4 runs through `@tailwindcss/vite` in development and production.
`src/client/tailwind.css` is the CSS entry point. It imports the existing UI styles
from `style.css` into the components layer, so utilities can override them without
`!important`. Tailwind Preflight is intentionally omitted to preserve the current
browser defaults, typography, and form controls. New controls should use explicit
styles (including `border-solid` when adding a border).

The existing layout, spacing, and responsive styles remain intact. Palette tokens
include `ink`, `canvas`, `muted`, `danger`, `success`, and `success-foreground`.
Use `cn()` from `src/client/cn.ts` for conditional classes and Tailwind overrides:

```tsx
class={cn('status', completed && 'bg-success text-success-foreground')}
```

`cn()` combines `clsx` with `tailwind-merge`; it resolves Tailwind utility conflicts,
not conflicts between custom CSS classes. Keep utility names complete and literal
so Tailwind can detect them. Both client and server templates under `src/` are scanned.

## Browser-console SQL

On the main todos page, open browser DevTools and run:

```js
await sql('SELECT * FROM todos ORDER BY created_at DESC')
await sql('UPDATE todos SET completed = 1 WHERE schedule_date < ? RETURNING id, title, completed', ['2026-01-01'])
await sqlUndo()
```

These helpers are **console-only**; the app never calls them. Their implementation
loads on first use, not with the initial bundle. Results use `console.table` and
are also returned as `{ rows, changes, undoToken }`. Writes without `RETURNING`
print an affected-row summary. Every query (including reads and failures) and
executed undo re-fetches todos without resetting filters or editor drafts.

SQL runs against the real server database. Use SQLite column names such as
`parent_id`, `schedule_date`, `schedule_time`, `due_date`, `due_time`, `created_at`,
and `updated_at`; `completed` is `0`/`1`. Tags are in `tags` and `todo_tags`.
**Raw SQL does not apply the REST API's descendant-field propagation or update
`updated_at` automatically. Include those changes explicitly in your query.**
Use stable todo IDs, not implicit rowids (undo may rebuild rowids).

Supported: one SELECT, INSERT, UPDATE, or DELETE statement, ordinary CTEs,
`RETURNING`, and positional `?` parameters (string, number, boolean, or null).
Writes may only target `todos`; reads may join `tags` and `todo_tags`. Schema
changes, transaction commands, other tables, recursive CTEs, table-valued
functions, and non-allowlisted scalar functions are rejected. Todo parent cycles
and incompatible field types are rejected too. Limits: 64 KiB request bodies,
32768 query characters, 999 parameters, 10000 rows per result/snapshot table, and
2 MB per result/combined undo snapshot. Oversized results roll back the query.
There is no execution timeout; avoid expensive Cartesian joins.

`sqlUndo()` restores the last successful **data-changing** query, including
cascading descendant deletions and tag links. Reads, failures, and no-op writes
preserve that undo point. There is one undo level, no redo, and availability is
lost on browser reload or server restart. A newer SQL write replaces the undo
point; intervening UI/API/other-tab changes cause undo to refuse rather than
clobber them. Operations in the same
page are guarded against overlap. If a write succeeds but refresh fails, do not
repeat it: refresh the page instead. A lost network response can also leave the
commit outcome uncertain; inspect current data before retrying.

### SQL console access

This is a privileged tool for a **private, single-user installation**, not a
public SQL API. Origin checks prevent cross-site browser use but are **not
authentication**. Keep the service private; add proper authentication before any
public exposure. No permissive CORS is enabled.

Same-origin loopback development works automatically. For Tailscale Serve or
another trusted reverse proxy, configure the exact browser origin in the server
environment (comma-separated if more than one):

```text
TODO_SQL_TRUSTED_ORIGINS=https://YOUR-TAILNET-HOST:3011
```

Restart the service after changing its environment. Forwarded headers are not
trusted for authorization. Unconfigured external origins and requests without an
Origin header are rejected, including ordinary curl requests.

## Todo fields

```ts
{
  id: string,
  title: string,
  description: string | null,
  completed: boolean,
  parentId: string | null,
  scheduleDate: string | null, // YYYY-MM-DD
  scheduleTime: string | null, // HH:MM:SS
  dueDate: string | null,
  dueTime: string | null,
  tags: string[],
  createdAt: string,
  updatedAt: string,
  subtodos?: Todo[]
}
```

## Endpoints

- `GET /healthcheck`
- `GET /api/todos?tag=work&completed=false&parentId=root&includeSubtodos=true&sort=schedule-asc`
- `POST /api/todos`
- `GET /api/todos/:id`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`
- `GET /api/tags`

Use `parentId` to make subtodos. Subtasks inherit their parent's tags, schedule, and due dates/times; changes to those parent fields propagate to all descendants without changing their completion status. The new/edit form accepts `subtodos: [{ title, completed? }]` on create and `subtodos: [{ id?, title, completed? }]` on update. When supplied on update, this array replaces the parent's direct subtask list (omitted entries are deleted); omit it to leave subtasks alone. Use `parentId=root` when listing to get only top-level todos.

## Example

```bash
curl -X POST http://127.0.0.1:3000/api/todos \
  -H 'content-type: application/json' \
  -d '{
    "title": "Build todo API",
    "tags": ["project", "api"],
    "scheduleDate": "2026-10-12",
    "scheduleTime": "09:00:00",
    "dueDate": "2026-10-13",
    "dueTime": "17:00:00"
  }'
```
