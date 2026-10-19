import type { SubtodoInput } from '../types'
import { AnimatedList } from './AnimatedList'

export type SubtaskDraft = SubtodoInput & { key: string }

export const blankSubtask = (): SubtaskDraft => ({
  key: crypto.randomUUID(),
  title: '',
  completed: false,
})

export function Subtasks({
  rows,
  onChange,
  disabled,
}: {
  rows: SubtaskDraft[]
  onChange: (rows: SubtaskDraft[]) => void
  disabled: boolean
}) {
  return (
    <section class="subtasks" aria-label="Subtasks">
      <strong>Subtasks</strong>
      <AnimatedList>
        {rows.map((row, index) => (
          <div class="subtask" key={row.key}>
            {index === rows.length - 1 && (
              <span class="subtask-spacer" aria-hidden="true" />
            )}
            {index < rows.length - 1 && (
              <input
                type="checkbox"
                aria-label={`Complete subtask ${row.title}`}
                checked={row.completed}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    rows.map((item, i) =>
                      i === index
                        ? { ...item, completed: event.currentTarget.checked }
                        : item,
                    ),
                  )
                }
              />
            )}
            <input
              type="text"
              class={row.completed ? 'done' : undefined}
              aria-label={
                index === rows.length - 1
                  ? 'New subtask title'
                  : `Subtask ${index + 1} title`
              }
              placeholder={
                index === rows.length - 1 ? 'Add a subtask…' : undefined
              }
              value={row.title}
              readOnly={disabled}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                event.currentTarget
                  .closest('.subtasks')
                  ?.querySelectorAll<HTMLInputElement>('input[type="text"]')
                  [index + 1]?.focus()
              }}
              onInput={(event) => {
                const title = event.currentTarget.value
                const next = rows.map((item, i) =>
                  i === index ? { ...item, title } : item,
                )
                if (index === rows.length - 1 && title.trim())
                  next.push(blankSubtask())
                onChange(next)
              }}
            />
            {index < rows.length - 1 && (
              <button
                type="button"
                aria-label={`Remove subtask ${row.title}`}
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </AnimatedList>
    </section>
  )
}
