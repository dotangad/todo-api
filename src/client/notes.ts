import { computed, signal } from '@preact/signals'
import { compareNotes, type Note, type NoteInput } from '../noteTypes'
import { api } from './actions'

export const notes = signal<Note[]>([])
export const orderedNotes = computed(() => [...notes.value].sort(compareNotes))
export const noteEditorId = signal<string | null>(null)
export const noteSaving = signal(false)
export const noteError = signal('')
export const noteDragType = 'application/x-todo-note'

export function openNote(id: string) {
  noteError.value = ''
  noteEditorId.value = id
}

async function mutate(
  id: string | null,
  method: string,
  input?: Partial<NoteInput>,
) {
  if (noteSaving.value) return false
  noteSaving.value = true
  noteError.value = ''
  try {
    const note = await api<Note>(id ? `/api/notes/${id}` : '/api/notes', {
      method,
      body: input ? JSON.stringify(input) : undefined,
    })
    // Use the returned record: a failed follow-up refresh must not duplicate a create.
    notes.value =
      method === 'DELETE'
        ? notes.value.filter((item) => item.id !== id)
        : [...notes.value.filter((item) => item.id !== note.id), note]
    return true
  } catch (error) {
    noteError.value =
      error instanceof Error ? error.message : 'Could not save note.'
    return false
  } finally {
    noteSaving.value = false
  }
}

export const createNote = (input: NoteInput) => mutate(null, 'POST', input)
export const updateNote = (id: string, input: Partial<NoteInput>) =>
  mutate(id, 'PATCH', input)
export const deleteNote = (id: string) => mutate(id, 'DELETE')
