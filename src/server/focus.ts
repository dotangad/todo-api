import { db, getTodo, transaction } from './database'

type CompletedTodo = { id: string; title: string }
type FocusRow = {
  selected_ids: string
  completed_todos: string
  elapsed_ms: number
  started_at: string | null
  session_started_at: string | null
}
export type FocusEvent = {
  id: string
  kind: 'start' | 'stop' | 'reset'
  occurredAt: string
  elapsedMs: number
  sessionId: string | null
}
export type WorkSession = {
  id: string
  startedAt: string
  endedAt: string
  durationMs: number
  completedTodos: CompletedTodo[]
}

db.exec(`create table if not exists focus_state (
  id integer primary key check (id = 1),
  selected_ids text not null default '[]',
  completed_todos text not null default '[]',
  elapsed_ms integer not null default 0,
  started_at text,
  session_started_at text
);
insert or ignore into focus_state (id) values (1);
create table if not exists focus_events (
  id text primary key,
  kind text not null check (kind in ('start', 'stop', 'reset')),
  occurred_at text not null,
  elapsed_ms integer not null,
  session_id text
);
create table if not exists work_sessions (
  id text primary key,
  started_at text not null,
  ended_at text not null,
  duration_ms integer not null,
  completed_todos text not null
)`)

const row = () =>
  db.query('select * from focus_state where id = 1').get() as FocusRow
const selected = (state: FocusRow): string[] => JSON.parse(state.selected_ids)
const completed = (state: FocusRow): CompletedTodo[] =>
  JSON.parse(state.completed_todos)
const timestamp = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

function logEvent(
  kind: FocusEvent['kind'],
  at: string,
  elapsedMs: number,
  sessionId: string | null = null,
) {
  db.query(
    'insert into focus_events (id, kind, occurred_at, elapsed_ms, session_id) values (?, ?, ?, ?, ?)',
  ).run(uuid(), kind, at, elapsedMs, sessionId)
}

export function listFocusEvents(): FocusEvent[] {
  return (
    db
      .query('select * from focus_events order by occurred_at desc, rowid desc')
      .all() as Array<{
      id: string
      kind: FocusEvent['kind']
      occurred_at: string
      elapsed_ms: number
      session_id: string | null
    }>
  ).map((event) => ({
    id: event.id,
    kind: event.kind,
    occurredAt: event.occurred_at,
    elapsedMs: event.elapsed_ms,
    sessionId: event.session_id,
  }))
}

export function listWorkSessions(): WorkSession[] {
  return (
    db
      .query('select * from work_sessions order by ended_at desc, rowid desc')
      .all() as Array<{
      id: string
      started_at: string
      ended_at: string
      duration_ms: number
      completed_todos: string
    }>
  ).map((session) => ({
    id: session.id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationMs: session.duration_ms,
    completedTodos: JSON.parse(session.completed_todos),
  }))
}

export function getFocus() {
  const state = row()
  // Discard deleted selections in the response; snapshots in past sessions remain intact.
  return {
    selectedIds: selected(state).filter(
      (id) => getTodo(id, false)?.parentId === null,
    ),
    completedTodos: completed(state),
    elapsedMs: state.elapsed_ms,
    startedAt: state.started_at,
    sessionStartedAt: state.session_started_at,
    events: listFocusEvents(),
    sessions: listWorkSessions(),
  }
}

export function selectFocusTasks(ids: string[]) {
  return transaction(() => {
    const state = row()
    if (state.session_started_at)
      throw new Error('Reset the current session before changing tasks.')
    const unique = [...new Set(ids)]
    if (
      !unique.length ||
      unique.some((id) => getTodo(id, false)?.parentId !== null)
    )
      throw new Error('Select at least one top-level todo.')
    db.query('update focus_state set selected_ids = ? where id = 1').run(
      JSON.stringify(unique),
    )
    return getFocus()
  })
}

export function startFocus() {
  return transaction(() => {
    const state = row()
    if (state.started_at) throw new Error('Stop the stopwatch first.')
    if (!selected(state).some((id) => getTodo(id, false)?.parentId === null))
      throw new Error('Select tasks before starting.')
    const at = timestamp()
    db.query(
      'update focus_state set started_at = ?, session_started_at = coalesce(session_started_at, ?) where id = 1',
    ).run(at, at)
    logEvent('start', at, state.elapsed_ms)
    return getFocus()
  })
}

function stop(state: FocusRow, at: string) {
  const elapsed =
    state.elapsed_ms +
    Math.max(0, Date.parse(at) - Date.parse(state.started_at as string))
  db.query(
    'update focus_state set elapsed_ms = ?, started_at = null where id = 1',
  ).run(elapsed)
  logEvent('stop', at, elapsed)
  return elapsed
}

export function stopFocus() {
  return transaction(() => {
    const state = row()
    if (!state.started_at) throw new Error('The stopwatch is not running.')
    stop(state, timestamp())
    return getFocus()
  })
}

export function resetFocus() {
  return transaction(() => {
    const state = row()
    if (!state.session_started_at) throw new Error('Start the stopwatch first.')
    const at = timestamp()
    const elapsed = state.started_at ? stop(state, at) : state.elapsed_ms
    const sessionId = uuid()
    db.query(
      'insert into work_sessions (id, started_at, ended_at, duration_ms, completed_todos) values (?, ?, ?, ?, ?)',
    ).run(
      sessionId,
      state.session_started_at,
      at,
      elapsed,
      state.completed_todos,
    )
    logEvent('reset', at, elapsed, sessionId)
    db.query(
      "update focus_state set elapsed_ms = 0, started_at = null, session_started_at = null, completed_todos = '[]' where id = 1",
    ).run()
    return getFocus()
  })
}

export function completeFocusTodo(todoId: string, isCompleted: boolean) {
  return transaction(() => {
    const state = row()
    const todo = getTodo(todoId, false)
    if (!todo) throw new Error('Todo not found.')
    let root = todo
    while (root.parentId) {
      const parent = getTodo(root.parentId, false)
      if (!parent) throw new Error('Todo not found.')
      root = parent
    }
    if (!selected(state).includes(root.id))
      throw new Error('Todo is not selected for focus.')
    db.query('update todos set completed = ?, updated_at = ? where id = ?').run(
      isCompleted ? 1 : 0,
      timestamp(),
      todoId,
    )
    if (state.session_started_at) {
      const next = completed(state).filter((item) => item.id !== todoId)
      if (isCompleted) next.push({ id: todoId, title: todo.title })
      db.query('update focus_state set completed_todos = ? where id = 1').run(
        JSON.stringify(next),
      )
    }
    return getFocus()
  })
}
