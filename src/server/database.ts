import { Database } from 'bun:sqlite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const databasePath =
  process.env.TODO_DATABASE_PATH ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../todos.sqlite')
export const db = new Database(databasePath, { create: true })
db.exec('pragma foreign_keys = on')

type SqlValue = null | number | bigint | string | Uint8Array
const all = <T>(query: string, ...parameters: SqlValue[]) =>
  db.query(query).all(...parameters) as T[]
const one = <T>(query: string, ...parameters: SqlValue[]) =>
  db.query(query).get(...parameters) as T | null
const run = (query: string, ...parameters: SqlValue[]) =>
  db.query(query).run(...parameters)
const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export function transaction<T>(work: () => T): T {
  db.exec('begin immediate')
  try {
    const result = work()
    db.exec('commit')
    return result
  } catch (error) {
    db.exec('rollback')
    throw error
  }
}

db.exec(`create table if not exists todos (
  id text primary key,
  title text not null,
  description text,
  completed integer not null default 0 check(completed in (0, 1)),
  parent_id text references todos(id) on delete cascade,
  schedule_date text,
  schedule_time text,
  due_date text,
  due_time text,
  created_at text not null,
  updated_at text not null
)`)

db.exec(`create table if not exists tags (
  id text primary key,
  name text not null unique
)`)

db.exec(`create table if not exists todo_tags (
  todo_id text not null references todos(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  primary key (todo_id, tag_id)
)`)

export type SubtodoInput = { id?: string; title: string; completed?: boolean }

export type TodoInput = {
  title: string
  subtodos?: SubtodoInput[]
  description?: string | null
  completed?: boolean
  parentId?: string | null
  scheduleDate?: string | null
  scheduleTime?: string | null
  dueDate?: string | null
  dueTime?: string | null
  tags?: string[]
}

export type TodoPatch = Partial<TodoInput>

export type Todo = Required<
  Omit<TodoInput, 'tags' | 'completed' | 'subtodos'>
> & {
  id: string
  completed: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  subtodos?: Todo[]
}

type TodoRow = {
  id: string
  title: string
  description: string | null
  completed: 0 | 1
  parent_id: string | null
  schedule_date: string | null
  schedule_time: string | null
  due_date: string | null
  due_time: string | null
  created_at: string
  updated_at: string
}

export type TodoFilters = {
  tag?: string
  completed?: boolean
  parentId?: string | null
  rootsOnly?: boolean
  dueDate?: string
  sort?: 'due-asc' | 'due-desc' | 'schedule-asc' | 'schedule-desc'
  includeSubtodos?: boolean
}

const tagName = (name: string) => name.trim().toLowerCase()
const todoExists = (todoId: string) =>
  !!one<{ id: string }>('select id from todos where id = ?', todoId)

function tagsForTodo(todoId: string) {
  return all<{ name: string }>(
    `
    select tags.name from tags
    join todo_tags on todo_tags.tag_id = tags.id
    where todo_tags.todo_id = ?
    order by tags.name
  `,
    todoId,
  ).map((row) => row.name)
}

function setTags(todoId: string, tags: string[]) {
  const names = [...new Set(tags.map(tagName).filter(Boolean))].sort()
  run('delete from todo_tags where todo_id = ?', todoId)
  for (const name of names) {
    let tag = one<{ id: string }>('select id from tags where name = ?', name)
    if (!tag) {
      tag = { id: id() }
      run('insert into tags (id, name) values (?, ?)', tag.id, name)
    }
    run('insert into todo_tags (todo_id, tag_id) values (?, ?)', todoId, tag.id)
  }
}

function toTodo(row: TodoRow, includeSubtodos = false): Todo {
  const todo: Todo = {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: !!row.completed,
    parentId: row.parent_id,
    scheduleDate: row.schedule_date,
    scheduleTime: row.schedule_time,
    dueDate: row.due_date,
    dueTime: row.due_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: tagsForTodo(row.id),
  }
  if (includeSubtodos) {
    todo.subtodos = all<TodoRow>(
      'select * from todos where parent_id = ? order by created_at asc',
      row.id,
    ).map((child) => toTodo(child, true))
  }
  return todo
}

export function listTodos(filters: TodoFilters = {}) {
  let sql = 'select distinct todos.* from todos'
  const parameters: SqlValue[] = []
  const clauses: string[] = []

  if (filters.tag) {
    sql +=
      ' join todo_tags on todo_tags.todo_id = todos.id join tags on tags.id = todo_tags.tag_id'
    clauses.push('tags.name = ?')
    parameters.push(tagName(filters.tag))
  }
  if (filters.rootsOnly) clauses.push('todos.parent_id is null')
  else if (filters.parentId !== undefined) {
    clauses.push('todos.parent_id = ?')
    parameters.push(filters.parentId)
  }
  if (filters.completed !== undefined) {
    clauses.push('todos.completed = ?')
    parameters.push(filters.completed ? 1 : 0)
  }
  if (filters.dueDate) {
    clauses.push('todos.due_date = ?')
    parameters.push(filters.dueDate)
  }
  if (clauses.length) sql += ` where ${clauses.join(' and ')}`
  if (filters.sort === 'schedule-asc' || filters.sort === 'schedule-desc') {
    const direction = filters.sort === 'schedule-asc' ? 'asc' : 'desc'
    sql += ` order by todos.schedule_date is null, todos.schedule_date ${direction}, coalesce(todos.schedule_time, '00:00:00') ${direction}, todos.created_at desc`
  } else if (filters.sort === 'due-asc')
    sql +=
      ' order by todos.due_date is null, todos.due_date asc, todos.created_at desc'
  else if (filters.sort === 'due-desc')
    sql +=
      ' order by todos.due_date is null, todos.due_date desc, todos.created_at desc'
  else sql += ' order by todos.created_at desc'
  return all<TodoRow>(sql, ...parameters).map((row) =>
    toTodo(row, !!filters.includeSubtodos),
  )
}

export function getTodo(todoId: string, includeSubtodos = true) {
  const row = one<TodoRow>('select * from todos where id = ?', todoId)
  return row ? toTodo(row, includeSubtodos) : null
}

function assertValidParent(
  parentId: string | null | undefined,
  todoId?: string,
) {
  if (parentId == null) return
  if (parentId === todoId) throw new Error('A todo cannot be its own parent.')
  if (!todoExists(parentId)) throw new Error('parentId does not exist.')
}

// A child inherits shared fields at creation; status and title remain independent.
function insertTodo(input: TodoInput) {
  const parent = input.parentId ? getTodo(input.parentId, false) : null
  const todoId = id()
  const createdAt = now()
  run(
    `insert into todos (id, title, description, completed, parent_id, schedule_date, schedule_time, due_date, due_time, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    todoId,
    input.title,
    input.description ?? null,
    input.completed ? 1 : 0,
    input.parentId ?? null,
    parent ? parent.scheduleDate : (input.scheduleDate ?? null),
    parent ? parent.scheduleTime : (input.scheduleTime ?? null),
    parent ? parent.dueDate : (input.dueDate ?? null),
    parent ? parent.dueTime : (input.dueTime ?? null),
    createdAt,
    createdAt,
  )
  setTags(todoId, parent ? parent.tags : (input.tags ?? []))
  return todoId
}

function syncSubtodos(parentId: string, subtodos: SubtodoInput[]) {
  const existing = all<{ id: string }>(
    'select id from todos where parent_id = ?',
    parentId,
  )
  const retained = new Set<string>()
  for (const child of subtodos) {
    if (child.id) {
      if (
        !existing.some((row) => row.id === child.id) ||
        retained.has(child.id)
      )
        throw new Error('Subtask does not belong to this todo.')
      retained.add(child.id)
      run(
        'update todos set title = ?, completed = ?, updated_at = ? where id = ?',
        child.title,
        child.completed ? 1 : 0,
        now(),
        child.id,
      )
    } else
      insertTodo({ title: child.title, completed: child.completed, parentId })
  }
  for (const child of existing) {
    if (!retained.has(child.id)) run('delete from todos where id = ?', child.id)
  }
}

export function createTodo(input: TodoInput) {
  assertValidParent(input.parentId)
  return transaction(() => {
    const todoId = insertTodo(input)
    if (input.subtodos) syncSubtodos(todoId, input.subtodos)
    const created = getTodo(todoId, true)
    if (!created) throw new Error('Created todo not found.')
    return created
  })
}

export function updateTodo(todoId: string, patch: TodoPatch) {
  if (!todoExists(todoId)) return null
  assertValidParent(patch.parentId, todoId)
  transaction(() => {
    const fields: [string, SqlValue][] = []
    if (patch.title !== undefined) fields.push(['title', patch.title])
    if (patch.description !== undefined)
      fields.push(['description', patch.description])
    if (patch.completed !== undefined)
      fields.push(['completed', patch.completed ? 1 : 0])
    if (patch.parentId !== undefined) fields.push(['parent_id', patch.parentId])
    if (patch.scheduleDate !== undefined)
      fields.push(['schedule_date', patch.scheduleDate])
    if (patch.scheduleTime !== undefined)
      fields.push(['schedule_time', patch.scheduleTime])
    if (patch.dueDate !== undefined) fields.push(['due_date', patch.dueDate])
    if (patch.dueTime !== undefined) fields.push(['due_time', patch.dueTime])
    if (fields.length) {
      fields.push(['updated_at', now()])
      run(
        `update todos set ${fields.map(([field]) => `${field} = ?`).join(', ')} where id = ?`,
        ...fields.map(([, value]) => value),
        todoId,
      )
    }
    if (patch.tags !== undefined) setTags(todoId, patch.tags)
    // Propagate only shared fields that changed, recursively, without touching status.
    const shared = fields.filter(([field]) =>
      ['schedule_date', 'schedule_time', 'due_date', 'due_time'].includes(
        field,
      ),
    )
    if (shared.length || patch.tags !== undefined) {
      const descendants = all<{ id: string }>(
        `with recursive descendants(id) as (
          select id from todos where parent_id = ?
          union all select todos.id from todos join descendants on todos.parent_id = descendants.id
        ) select id from descendants`,
        todoId,
      )
      for (const child of descendants) {
        if (shared.length)
          run(
            `update todos set ${shared.map(([field]) => `${field} = ?`).join(', ')}, updated_at = ? where id = ?`,
            ...shared.map(([, value]) => value),
            now(),
            child.id,
          )
        if (patch.tags !== undefined) setTags(child.id, patch.tags)
      }
    }
    if (patch.subtodos !== undefined) syncSubtodos(todoId, patch.subtodos)
  })
  return getTodo(todoId, true)
}

export function deleteTodo(todoId: string) {
  return run('delete from todos where id = ?', todoId).changes > 0
}

export function listTags() {
  return all<{ id: string; name: string }>('select * from tags order by name')
}
