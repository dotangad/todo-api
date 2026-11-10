export const noteColors = [
  'default',
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
] as const
export type NoteColor = (typeof noteColors)[number]

export type NoteInput = {
  title: string
  content: string
  // Null/absent preserves legacy plain text, including literal HTML characters.
  contentHtml?: string | null
  color: NoteColor
  scheduleDate: string | null
}

export type Note = NoteInput & {
  id: string
  createdAt: string
  updatedAt: string
}

export function compareNotes(a: Note, b: Note) {
  return (
    b.updatedAt.localeCompare(a.updatedAt) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  )
}
