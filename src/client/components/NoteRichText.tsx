import type { ComponentType } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { NoteRichTextProps } from './NoteRichTextEditor'

// Keep the editor engine out of the initial todos/board bundle.
export function NoteRichText(props: NoteRichTextProps) {
  const [Editor, setEditor] = useState<ComponentType<NoteRichTextProps> | null>(
    null,
  )
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(false)
    import('./NoteRichTextEditor').then(
      (module) => {
        if (active) setEditor(() => module.NoteRichText)
      },
      () => {
        if (active) setError(true)
      },
    )
    return () => {
      active = false
    }
  }, [attempt])
  if (Editor) return <Editor {...props} />
  return error ? (
    <p role="alert">
      Could not load the editor.{' '}
      <button
        type="button"
        class="note-text-button"
        onClick={() => setAttempt((value) => value + 1)}
      >
        Retry
      </button>
    </p>
  ) : (
    <p role="status">Loading editor…</p>
  )
}
