import 'vite/modulepreload-polyfill'
import './tailwind.css'
import { h, render } from 'preact'
import { App } from './components/App'
import { todos } from './state'
import { startUrlSync } from './urlState'

const root = document.querySelector<HTMLElement>('[data-todo-app]')
if (!root) throw new Error('Todo app root not found.')
todos.value = JSON.parse(root.dataset.initialState ?? '[]')
const stopUrlSync = startUrlSync()

// The fallback HTML comes from Hono, so mount rather than hydrate it.
root.replaceChildren()
render(h(App, {}), root)

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stopUrlSync()
    render(null, root)
  })
