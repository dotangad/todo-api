import { CalendarDays, StickyNote } from 'lucide-preact'
import type { Note } from '../../noteTypes'
import { noteSaving, openNote } from '../notes'
import { useCardDrag } from '../useCardDrag'
import { NoteContent } from './NoteContent'

export function NoteCard({
  note,
  board = false,
}: {
  note: Note
  board?: boolean
}) {
  const { dragging, handlers } = useCardDrag(note.id, board, 'note')
  return (
    <article
      class={`note-card note-color-${note.color}${board ? ' board-note' : ''}${dragging ? ' dragging' : ''}`}
      draggable={board && !noteSaving.value}
      {...handlers}
    >
      <button
        class="note-card-open"
        type="button"
        onClick={() => openNote(note.id)}
        aria-label={`Edit note: ${note.title || note.content.slice(0, 60)}`}
      >
        {board && (
          <span class="note-kind">
            <StickyNote size={13} aria-hidden="true" /> Note
          </span>
        )}
        {note.title && <h2>{note.title}</h2>}
        <NoteContent note={note} />
        {note.scheduleDate && (
          <span class="note-date-chip">
            <CalendarDays size={13} aria-hidden="true" />
            <time dateTime={note.scheduleDate}>{note.scheduleDate}</time>
          </span>
        )}
      </button>
    </article>
  )
}
