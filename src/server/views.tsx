import type { PropsWithChildren } from 'hono/jsx'
import type { Todo } from './database'
import { assets } from './assets'

export function Layout({ children }: PropsWithChildren) {
  const urls = assets()
  return <html lang="en"><head>
    <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Todos</title>
    {urls.css.map(href => <link rel="stylesheet" href={href} />)}
    {urls.scripts.map(src => <script type="module" src={src}></script>)}
  </head><body>{children}</body></html>
}

export function TodoPage({ todos }: { todos: Todo[] }) {
  return <main class="app-shell">
    <header class="topbar"><div><p class="eyebrow">PERSONAL WORKSPACE</p><h1>Todos</h1></div><button class="new-button" type="button" data-new-todo>+ New todo</button></header>
    <div class="app" data-todo-app data-initial-state={JSON.stringify(todos)}>
      <nav class="view-tabs" aria-label="Views"><button class="active" type="button" data-view="table">Table</button><button type="button" data-view="board">Board</button></nav>
      <section class="table-view" data-view-panel="table">
        <div class="database-head"><span>Name</span><span>Status</span><span>Schedule</span><span>Due</span><span>Tags</span></div>
        {todos.map(todo => <div class="todo-row"><span>{todo.title}</span><span>{todo.completed ? 'Done' : 'Open'}</span><span>{todo.scheduleDate ?? '—'}</span><span>{todo.dueDate ?? '—'}</span><span>{todo.tags.join(', ') || '—'}</span></div>)}
      </section>
    </div>
  </main>
}
