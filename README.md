# Todo API

Bun + Hono REST API backed by SQLite.

## Run

```bash
bun install
bun run dev
```

The database is created automatically at `todos.sqlite`. Override with `TODO_DATABASE_PATH=/path/to/todos.sqlite`.

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
- `GET /api/todos?tag=work&completed=false&parentId=root&includeSubtodos=true`
- `POST /api/todos`
- `GET /api/todos/:id`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`
- `GET /api/tags`

Use `parentId` to make subtodos. Use `parentId=root` when listing to get only top-level todos.

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
