import { SquareKanban, TableProperties } from 'lucide-preact'
import { useEffect } from 'preact/hooks'
import { isNewTodoHotkey } from '../newTodoHotkey'
import {
  deleteId,
  editorId,
  errorMessage,
  openEditor,
  saving,
  view,
} from '../state'
import { Filters } from './Filters'
import { ModalLayer } from './ModalLayer'
import { TodoBoard } from './TodoBoard'
import { TodoTable } from './TodoTable'

export function App() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target =
        event.target instanceof Element ? event.target : document.activeElement
      const editableFocused =
        (target instanceof HTMLElement && target.isContentEditable) ||
        !!target?.closest('input, textarea, select, [role="textbox"]')
      const modalOpen =
        editorId.value !== null ||
        deleteId.value !== null ||
        saving.value ||
        document.querySelector('dialog[open]') !== null
      if (!isNewTodoHotkey(event, modalOpen, editableFocused)) return
      event.preventDefault()
      openEditor()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
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
            aria-keyshortcuts="N"
            onClick={() => openEditor()}
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
              type="button"
              class={view.value === 'table' ? 'active' : ''}
              aria-label="Table view"
              title="Table view"
              aria-pressed={view.value === 'table'}
              onClick={() => {
                view.value = 'table'
              }}
            >
              <TableProperties size={22} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              class={view.value === 'board' ? 'active' : ''}
              aria-label="Kanban board view"
              title="Kanban board view"
              aria-pressed={view.value === 'board'}
              onClick={() => {
                view.value = 'board'
              }}
            >
              <SquareKanban size={22} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </nav>
          <Filters />
          {!editorId.value && errorMessage.value && (
            <span role="status">{errorMessage.value}</span>
          )}
        </div>
        {view.value === 'table' ? <TodoTable /> : <TodoBoard />}
      </div>
      <ModalLayer />
    </>
  )
}
