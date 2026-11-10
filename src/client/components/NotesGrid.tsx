import { useLayoutEffect, useRef } from 'preact/hooks'
import type { Note } from '../../noteTypes'
import { NoteCard } from './NoteCard'

// Size grid rows to each card instead of CSS columns, which would put the
// second-newest note below the first rather than beside it like Keep.
export function NotesGrid({ notes }: { notes: Note[] }) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return
    function size(card: HTMLElement) {
      card.style.gridRowEnd = `span ${Math.ceil(card.getBoundingClientRect().height + 16)}`
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) size(entry.target as HTMLElement)
    })
    for (const card of grid.querySelectorAll<HTMLElement>('.note-card')) {
      size(card)
      observer.observe(card)
    }
    return () => observer.disconnect()
  }, [notes])
  return (
    <section
      ref={ref}
      class="notes-grid notes-masonry"
      aria-label="Notes, last edited first"
    >
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </section>
  )
}
