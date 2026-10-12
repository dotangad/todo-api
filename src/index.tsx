import { Hono } from 'hono'
import { html } from 'hono/html'
import { createTodo, deleteTodo, getTodo, listTags, listTodos, updateTodo, type TodoInput, type TodoPatch } from './server/database'
import { Layout, TodoPage } from './server/views'

const app = new Hono()
const invalid = (message: string) => ({ error: { message } })

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}(:\d{2})?$/

type RawTodo = Record<string, unknown>

function cleanString(value: unknown, field: string, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required.`)
    return value === null ? null : undefined
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new Error(`${field} is required.`)
  return trimmed
}

function cleanDate(value: unknown, field: string) {
  const cleaned = cleanString(value, field)
  if (cleaned == null) return cleaned
  if (!datePattern.test(cleaned)) throw new Error(`${field} must be YYYY-MM-DD.`)
  return cleaned
}

function cleanTime(value: unknown, field: string) {
  const cleaned = cleanString(value, field)
  if (cleaned == null) return cleaned
  if (!timePattern.test(cleaned)) throw new Error(`${field} must be HH:MM or HH:MM:SS.`)
  return cleaned.length === 5 ? `${cleaned}:00` : cleaned
}

function parseTodo(body: RawTodo, partial = false): TodoInput | TodoPatch {
  const todo: TodoPatch = {}
  if (!partial || body.title !== undefined) todo.title = cleanString(body.title, 'title', true) as string
  if (body.description !== undefined) todo.description = cleanString(body.description, 'description')
  if (body.completed !== undefined) {
    if (typeof body.completed !== 'boolean') throw new Error('completed must be a boolean.')
    todo.completed = body.completed
  }
  if (body.parentId !== undefined) todo.parentId = cleanString(body.parentId, 'parentId')
  if (body.scheduleDate !== undefined) todo.scheduleDate = cleanDate(body.scheduleDate, 'scheduleDate')
  if (body.scheduleTime !== undefined) todo.scheduleTime = cleanTime(body.scheduleTime, 'scheduleTime')
  if (body.dueDate !== undefined) todo.dueDate = cleanDate(body.dueDate, 'dueDate')
  if (body.dueTime !== undefined) todo.dueTime = cleanTime(body.dueTime, 'dueTime')
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== 'string')) throw new Error('tags must be an array of strings.')
    todo.tags = body.tags
  }
  if (todo.scheduleTime && todo.scheduleDate === null) throw new Error('scheduleDate is required when scheduleTime is set.')
  if (todo.dueTime && todo.dueDate === null) throw new Error('dueDate is required when dueTime is set.')
  return todo
}

app.get('/', c => c.html(html`<!doctype html>${<Layout><TodoPage todos={listTodos({ includeSubtodos: true })} /></Layout>}`))
app.get('/healthcheck', c => c.text('OK'))

app.get('/api/todos', c => {
  const query = c.req.query()
  const completed = query.completed === undefined ? undefined : query.completed === 'true' ? true : query.completed === 'false' ? false : null
  if (completed === null) return c.json(invalid('completed must be true or false.'), 400)
  return c.json(listTodos({
    tag: query.tag,
    completed,
    parentId: query.parentId,
    rootsOnly: query.parentId === 'root',
    dueDate: query.dueDate,
    sort: query.sort === 'due-asc' || query.sort === 'due-desc' ? query.sort : undefined,
    includeSubtodos: query.includeSubtodos === 'true',
  }))
})

app.post('/api/todos', async c => {
  const body = await c.req.json().catch(() => null) as RawTodo | null
  if (!body || typeof body !== 'object') return c.json(invalid('JSON body is required.'), 400)
  try {
    return c.json(createTodo(parseTodo(body) as TodoInput), 201)
  } catch (error) {
    return c.json(invalid(error instanceof Error ? error.message : 'Invalid todo.'), 400)
  }
})

app.get('/api/todos/:id', c => {
  const todo = getTodo(c.req.param('id'), c.req.query('includeSubtodos') !== 'false')
  return todo ? c.json(todo) : c.json(invalid('Todo not found.'), 404)
})

app.patch('/api/todos/:id', async c => {
  const body = await c.req.json().catch(() => null) as RawTodo | null
  if (!body || typeof body !== 'object') return c.json(invalid('JSON body is required.'), 400)
  try {
    const todo = updateTodo(c.req.param('id'), parseTodo(body, true))
    return todo ? c.json(todo) : c.json(invalid('Todo not found.'), 404)
  } catch (error) {
    return c.json(invalid(error instanceof Error ? error.message : 'Invalid todo.'), 400)
  }
})

app.delete('/api/todos/:id', c => deleteTodo(c.req.param('id')) ? c.body(null, 204) : c.json(invalid('Todo not found.'), 404))

app.get('/api/tags', c => c.json(listTags()))

export default app
