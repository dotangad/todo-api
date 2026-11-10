import { noteEditorId, notes } from '../notes'
import { NoteForm } from './NoteForm'

export function NoteEditor() {
  const note = notes.value.find((item) => item.id === noteEditorId.value)
  return note ? (
    <NoteForm
      key={note.id}
      note={note}
      modal
      onClose={() => {
        noteEditorId.value = null
      }}
    />
  ) : null
}
