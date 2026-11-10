import type { Note } from '../../noteTypes'
import { cleanNoteHtml } from '../noteHtml'

export function NoteContent({ note }: { note: Note }) {
  if (note.contentHtml != null) {
    // Sanitized again at the rendering boundary, even for records already cleaned by the API.
    return (
      <div
        class="note-rich-preview"
        dangerouslySetInnerHTML={{
          __html: cleanNoteHtml(note.contentHtml, true),
        }}
      />
    )
  }
  return note.content ? <p>{note.content}</p> : null
}
