import 'vite/modulepreload-polyfill'
import './tailwind.css'
import { render } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { dateKey } from './dates'
import { recordedOnDay, scheduledForDay } from './focusDay'
import type { Todo } from './types'

type CompletedTodo = { id: string; title: string }
type FocusEvent = {
  id: string
  kind: 'start' | 'stop' | 'reset'
  occurredAt: string
  elapsedMs: number
  sessionId: string | null
}
type WorkSession = {
  id: string
  startedAt: string
  endedAt: string
  durationMs: number
  completedTodos: CompletedTodo[]
}
type FocusState = {
  selectedIds: string[]
  completedTodos: CompletedTodo[]
  elapsedMs: number
  startedAt: string | null
  sessionStartedAt: string | null
  events: FocusEvent[]
  sessions: WorkSession[]
}

async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result?.error?.message ?? 'Request failed.')
  return result as T
}

function duration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function TaskPicker({
  tasks,
  selected,
  busy,
  error,
  onSave,
  onClose,
}: {
  tasks: Todo[]
  selected: string[]
  busy: boolean
  error: string
  onSave: (ids: string[]) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [ids, setIds] = useState(() =>
    selected.filter((id) => tasks.some((task) => task.id === id)),
  )
  useLayoutEffect(() => {
    dialog.current?.showModal()
    return () => dialog.current?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-label="Select focus tasks"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      class="max-h-[calc(100vh-2rem)] w-[min(calc(100%-2rem),560px)] overflow-auto rounded-2xl border border-solid border-[#555551] bg-[#343433] p-0 text-[#e3e3de] shadow-[0_20px_60px_#16161666] backdrop:bg-[#1a1a1acc]"
    >
      <div class="px-6 py-5">
        <h2 class="m-0 text-xl font-semibold">Choose your focus tasks</h2>
      </div>
      <div class="max-h-[50vh] space-y-2 overflow-y-auto px-6 py-5">
        {tasks.length ? (
          tasks.map((task) => (
            <label
              key={task.id}
              class="flex cursor-pointer items-start gap-3 rounded-xl bg-[#3c3c3a] px-4 py-3"
            >
              <input
                type="checkbox"
                class="mt-1 size-4 accent-[#deded9]"
                checked={ids.includes(task.id)}
                disabled={busy}
                onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setIds((current) =>
                    checked
                      ? [...current, task.id]
                      : current.filter((id) => id !== task.id),
                  )
                }}
              />
              <span class="min-w-0 flex-1">
                <span class="block font-medium">{task.title}</span>
                {!!task.subtodos?.length && (
                  <span class="mt-1 block text-xs text-[#aaa9a5]">
                    {task.subtodos.length} subtask
                    {task.subtodos.length === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            </label>
          ))
        ) : (
          <p class="m-0 text-sm text-[#aaa9a5]">
            No tasks scheduled for today. Schedule a task on the main page
            first.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" class="mx-6 mt-0 mb-4 text-sm text-[#deded9]">
          {error}
        </p>
      )}
      <div class="flex justify-end gap-3 px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          class="rounded-lg border border-solid border-[#656560] bg-transparent px-4 py-2 text-sm text-[#e3e3de] hover:bg-[#444442]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !ids.length}
          onClick={() => onSave(ids)}
          class="rounded-lg border-0 bg-[#deded9] px-4 py-2 text-sm font-semibold text-[#252525] hover:bg-[#ebebe6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use selected tasks
        </button>
      </div>
    </dialog>
  )
}

function TaskItem({
  task,
  busy,
  onComplete,
  depth = 0,
}: {
  task: Todo
  busy: boolean
  depth?: number
  onComplete: (id: string, completed: boolean) => void
}) {
  return (
    <>
      <label
        class="flex items-center gap-3 py-3"
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        <input
          type="checkbox"
          class="size-5 shrink-0 accent-[#deded9]"
          checked={task.completed}
          disabled={busy}
          onChange={(event) => onComplete(task.id, event.currentTarget.checked)}
        />
        <span
          class={
            task.completed ? 'text-[#888883] line-through' : 'text-[#e3e3de]'
          }
        >
          {task.title}
        </span>
      </label>
      {task.subtodos?.map((child) => (
        <TaskItem
          key={child.id}
          task={child}
          depth={depth + 1}
          busy={busy}
          onComplete={onComplete}
        />
      ))}
    </>
  )
}

function FocusApp() {
  const [tasks, setTasks] = useState<Todo[]>([])
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(Date.now())

  useEffect(() => {
    let active = true
    Promise.all([
      api<FocusState>('/api/focus'),
      api<Todo[]>('/api/todos?parentId=root&includeSubtodos=true'),
    ])
      .then(([state, todos]) => {
        if (!active) return
        setFocus(state)
        setTasks(todos)
        setPickerOpen(!state.sessionStartedAt)
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load focus mode.',
          )
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function action(
    path: string,
    method = 'POST',
    body?: unknown,
    refreshTasks = false,
  ) {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      const next = await api<FocusState>(path, method, body)
      setFocus(next)
      if (refreshTasks)
        setTasks(
          await api<Todo[]>('/api/todos?parentId=root&includeSubtodos=true'),
        )
      setClock(Date.now())
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const elapsed = focus
    ? focus.elapsedMs +
      (focus.startedAt ? Math.max(0, clock - Date.parse(focus.startedAt)) : 0)
    : 0
  const today = dateKey(new Date(clock))
  const todaysTasks = scheduledForDay(tasks, today)
  const selectedTasks = tasks.filter(
    (task) =>
      focus?.selectedIds.includes(task.id) &&
      (focus.sessionStartedAt || task.scheduleDate === today),
  )
  const todaysEvents = recordedOnDay(
    focus?.events ?? [],
    today,
    (event) => event.occurredAt,
  )
  const todaysSessions = recordedOnDay(
    focus?.sessions ?? [],
    today,
    (session) => session.endedAt,
  )
  return (
    <div class="min-h-screen bg-[#252525] px-5 py-8 text-[#e3e3de] sm:px-8">
      <div class="mx-auto max-w-5xl">
        <header class="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="mt-2 mb-0 text-3xl font-semibold tracking-tight">
              Focus mode
            </h1>
          </div>
          <a
            href="/"
            class="rounded-lg border border-solid border-[#555551] px-4 py-2 text-sm text-[#deded9] no-underline hover:bg-[#3c3c3a]"
          >
            ← All todos
          </a>
        </header>
        {error && (
          <p
            role="alert"
            class="mb-5 rounded-lg border border-solid border-[#777772] bg-[#353534] p-3 text-sm text-[#deded9]"
          >
            {error}
          </p>
        )}
        {!focus ? (
          <p class="text-[#aaa9a5]">Loading focus mode…</p>
        ) : (
          <>
            <section
              aria-label="Stopwatch"
              class="rounded-2xl border border-solid border-[#484846] bg-[#313130] px-6 py-10 text-center shadow-[0_10px_30px_#16161633]"
            >
              <div
                class="my-7 font-mono text-[clamp(4rem,12vw,8rem)] leading-none font-light tracking-tight tabular-nums"
                role="timer"
                aria-label={`${duration(elapsed)} hours and minutes`}
              >
                {duration(elapsed)}
              </div>
              <div class="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  disabled={busy || !selectedTasks.length}
                  onClick={() => {
                    void action(
                      focus.startedAt ? '/api/focus/stop' : '/api/focus/start',
                    )
                  }}
                  class="min-w-28 rounded-lg border-0 bg-[#deded9] px-5 py-3 font-semibold text-[#252525] hover:bg-[#ebebe6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {focus.startedAt ? 'Stop' : 'Start'}
                </button>
                <button
                  type="button"
                  disabled={busy || !focus.sessionStartedAt}
                  onClick={() => {
                    void action('/api/focus/reset')
                  }}
                  class="rounded-lg border border-solid border-[#656560] bg-transparent px-5 py-3 text-[#e3e3de] hover:bg-[#444442] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset & save session
                </button>
              </div>
            </section>
            <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
              <section class="min-w-0 rounded-2xl border border-solid border-[#484846] bg-[#313130] p-4 px-6">
                {selectedTasks.length ? (
                  <div class="my-2">
                    {selectedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        busy={busy}
                        onComplete={(id, completed) => {
                          void action(
                            `/api/focus/todos/${id}`,
                            'PATCH',
                            { completed },
                            true,
                          )
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p class="mt-5 text-sm text-[#aaa9a5]">
                    Select tasks to start focusing.
                  </p>
                )}
              </section>
              <aside class="space-y-6">
                <section class="rounded-2xl border border-solid border-[#484846] bg-[#313130] p-6">
                  <h2 class="m-0 text-lg font-semibold">Stopwatch log</h2>
                  {todaysEvents.length ? (
                    <ol class="mt-4 mb-0 space-y-3 p-0 text-sm list-none">
                      {todaysEvents.map((event) => (
                        <li
                          key={event.id}
                          class="flex justify-between gap-3 text-[#deded9]"
                        >
                          <span class="capitalize">{event.kind}</span>
                          <time
                            class="text-[#aaa9a5]"
                            dateTime={event.occurredAt}
                          >
                            {new Date(event.occurredAt).toLocaleString()}
                          </time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p class="mt-4 mb-0 text-sm text-[#aaa9a5]">
                      No stopwatch events today.
                    </p>
                  )}
                </section>
                <section class="rounded-2xl border border-solid border-[#484846] bg-[#313130] p-6">
                  <h2 class="m-0 text-lg font-semibold">Work sessions</h2>
                  {todaysSessions.length ? (
                    <ol class="mt-4 mb-0 space-y-4 p-0 list-none">
                      {todaysSessions.map((session) => (
                        <li key={session.id} class="pt-3 text-sm">
                          <div class="flex justify-between gap-2">
                            <time
                              class="text-[#deded9]"
                              dateTime={session.endedAt}
                            >
                              {new Date(session.endedAt).toLocaleString()}
                            </time>
                            <strong class="font-mono text-[#deded9]">
                              {duration(session.durationMs)}
                            </strong>
                          </div>
                          <p class="mt-2 mb-0 text-[#aaa9a5]">
                            {session.completedTodos.length
                              ? `Completed: ${session.completedTodos.map((todo) => todo.title).join(', ')}`
                              : 'No todos completed'}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p class="mt-4 mb-0 text-sm text-[#aaa9a5]">
                      No work sessions saved today.
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
      {pickerOpen && focus && (
        <TaskPicker
          key={today}
          tasks={todaysTasks}
          selected={focus.selectedIds}
          busy={busy}
          error={error}
          onClose={() => setPickerOpen(false)}
          onSave={async (ids) => {
            if (await action('/api/focus/tasks', 'PUT', { ids }))
              setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

const root = document.querySelector<HTMLElement>('[data-focus-app]')
if (!root) throw new Error('Focus app root not found.')
render(<FocusApp />, root)
if (import.meta.hot) import.meta.hot.dispose(() => render(null, root))
