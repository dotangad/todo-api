import { useEffect, useState } from 'preact/hooks'
import { type Note, type NoteInput, noteColors } from '../../noteTypes'
import {
  createNote,
  deleteNote,
  noteError,
  noteSaving,
  updateNote,
} from '../notes'
import { Dialog } from './Dialog'
import { NoteRichText } from './NoteRichText'

export function NoteForm({
  note,
  modal = false,
  onClose,
}: {
  note?: Note
  modal?: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState<NoteInput>({
    title: note?.title ?? '',
    content: note?.content ?? '',
    contentHtml: note?.contentHtml ?? null,
    color: note?.color ?? 'default',
    scheduleDate: note?.scheduleDate ?? null,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = note
    ? Object.entries(draft).some(
        ([key, value]) => (note[key as keyof NoteInput] ?? null) !== value,
      )
    : !!(draft.title.trim() || draft.content.trim())
  const change = (patch: Partial<NoteInput>) =>
    setDraft((current) => ({ ...current, ...patch }))

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save() {
    if (noteSaving.value) return
    if (!dirty) {
      onClose()
      return
    }
    if (await (note ? updateNote(note.id, draft) : createNote(draft))) onClose()
  }

  const form = (
    <form
      class={`note-form note-color-${draft.color}`}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset disabled={noteSaving.value}>
        <input
          class="note-title-input"
          aria-label="Note title"
          placeholder="Title"
          value={draft.title}
          onInput={(event) => change({ title: event.currentTarget.value })}
        />
        <NoteRichText
          content={draft.content}
          contentHtml={draft.contentHtml}
          disabled={noteSaving.value}
          onChange={change}
        />
        <div class="note-options">
          <fieldset class="note-colors" aria-label="Note color">
            {noteColors.map((color) => (
              <button
                key={color}
                type="button"
                class={`note-swatch note-color-${color}`}
                aria-label={`${color} color`}
                title={`${color} color`}
                aria-pressed={draft.color === color}
                onClick={() => change({ color })}
              >
                {draft.color === color ? '✓' : ''}
              </button>
            ))}
          </fieldset>
          <label class="note-date-field">
            Board date
            <input
              type="date"
              aria-label="Board date"
              value={draft.scheduleDate ?? ''}
              onInput={(event) =>
                change({ scheduleDate: event.currentTarget.value || null })
              }
            />
          </label>
          {draft.scheduleDate && (
            <button
              class="note-text-button"
              type="button"
              onClick={() => change({ scheduleDate: null })}
            >
              Remove date
            </button>
          )}
        </div>
        {noteError.value && (
          <p class="note-error" role="alert">
            {noteError.value}
          </p>
        )}
        {confirmDelete ? (
          <div class="note-form-footer">
            <span>Delete this note permanently?</span>
            <button
              class="note-text-button"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              Keep note
            </button>
            <button
              class="note-text-button note-error"
              type="button"
              onClick={async () => {
                if (note && (await deleteNote(note.id))) onClose()
              }}
            >
              Delete note
            </button>
          </div>
        ) : (
          <div class="note-form-footer">
            {note && (
              <button
                class="note-text-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
            <span class="note-edited">
              {note
                ? `Edited ${new Date(note.updatedAt).toLocaleString()}`
                : 'Dates attach notes to your board'}
            </span>
            <button class="note-text-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button class="note-text-button note-save" type="submit">
              {noteSaving.value ? 'Saving…' : 'Close'}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  )
  return modal ? (
    <Dialog
      title="Edit note"
      className={`note-modal note-color-${draft.color}`}
      busy={noteSaving.value}
      onDismiss={() => {
        void save()
      }}
    >
      {form}
    </Dialog>
  ) : (
    form
  )
}
