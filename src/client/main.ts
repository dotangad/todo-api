import 'vite/modulepreload-polyfill'
import './style.css'
import { mountTodos } from './todos'

const cleanups = Array.from(document.querySelectorAll<HTMLElement>('[data-todo-app]'), mountTodos)
if (import.meta.hot) import.meta.hot.dispose(() => cleanups.forEach(cleanup => cleanup()))
