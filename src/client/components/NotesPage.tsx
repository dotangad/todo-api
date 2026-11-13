import { Lightbulb, StickyNote } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { noteError, orderedNotes } from '../notes'
import { NoteEditor } from './NoteEditor'
import { NoteForm } from './NoteForm'
import { NotesGrid } from './NotesGrid'

export function NotesPage() {
  const [composing, setComposing] = useState(false)
  return (
    <>
      <header class="topbar notes-topbar">
        <div class="notes-heading">
          <span class="notes-logo">
            <Lightbulb size={26} aria-hidden="true" />
          </span>
          <h1>Notes</h1>
        </div>
        <nav aria-label="Workspace" class="notes-nav">
          <a class="topbar-action topbar-action--secondary" href="/habits">
            Habits
          </a>
          <a class="topbar-action topbar-action--secondary" href="/">
            Todos
          </a>
          <a class="topbar-action topbar-action--secondary" href="/?view=board">
            Board
          </a>
        </nav>
      </header>
      <div class="note-composer">
        {composing ? (
          <NoteForm onClose={() => setComposing(false)} />
        ) : (
          <button
            class="note-composer-trigger"
            type="button"
            onClick={() => {
              noteError.value = ''
              setComposing(true)
            }}
          >
            Take a note… <StickyNote size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {orderedNotes.value.length ? (
        <>
          <p class="notes-section-label">
            ALL NOTES <span>Last edited first</span>
          </p>
          <NotesGrid notes={orderedNotes.value} />
        </>
      ) : (
        <div class="notes-empty">
          <Lightbulb size={72} strokeWidth={1} aria-hidden="true" />
          <h2>Your ideas, all in one place</h2>
          <p>Take a note above. Add a date to see it on your board.</p>
        </div>
      )}
      <NoteEditor />
    </>
  )
}
