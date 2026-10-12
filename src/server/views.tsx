import type { PropsWithChildren } from 'hono/jsx'
import { assets, type ClientEntry } from './assets'
import type { Todo } from './database'

export function Layout({
  children,
  title = 'Todos',
  entry,
}: PropsWithChildren<{ title?: string; entry?: ClientEntry }>) {
  const urls = assets(entry)
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {urls.css.map((href) => (
          <link rel="stylesheet" href={href} />
        ))}
        {urls.scripts.map((src) => (
          <script type="module" src={src}></script>
        ))}
      </head>
      <body>{children}</body>
    </html>
  )
}

export function TodoPage({ todos }: { todos: Todo[] }) {
  return (
    <main
      class="app-shell"
      data-todo-app
      data-initial-state={JSON.stringify(todos)}
    >
      <header class="topbar">
        <div>
          <p class="eyebrow">PERSONAL WORKSPACE</p>
          <h1>Todos</h1>
        </div>
        <div class="flex items-center gap-2">
          <a href="/focus" class="topbar-action topbar-action--secondary">
            Focus mode
          </a>
          <button
            class="new-button topbar-action"
            type="button"
            data-new-todo
            aria-keyshortcuts="N"
          >
            New todo
            <kbd class="rounded border border-solid border-white/40 px-1.5 py-0.5 font-sans text-xs font-medium text-white/80">
              N
            </kbd>
          </button>
        </div>
      </header>
      <div class="app">
        <div class="view-switcher">
          <nav class="view-tabs" aria-label="Views">
            <button
              class="active"
              type="button"
              data-view="table"
              aria-label="Table view"
              title="Table view"
              aria-pressed="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3v18" />
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18M3 15h18" />
              </svg>
            </button>
            <button
              type="button"
              data-view="board"
              aria-label="Kanban board view"
              title="Kanban board view"
              aria-pressed="false"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M8 7v10M12 7v4M16 7v7" />
              </svg>
            </button>
          </nav>
        </div>
        <section class="table-view" data-view-panel="table">
          <div class="database-head">
            <span>Name</span>
            <span>Status</span>
            <span>Schedule</span>
            <span>Due</span>
            <span>Tags</span>
          </div>
          {todos.map((todo) => (
            <div class="todo-row">
              <span>{todo.title}</span>
              <span>{todo.completed ? 'Done' : 'Open'}</span>
              <span>{todo.scheduleDate ?? '—'}</span>
              <span>{todo.dueDate ?? '—'}</span>
              <span>{todo.tags.join(', ') || '—'}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
