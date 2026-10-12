import { useState } from 'preact/hooks'
import { createTodo, updateTodo } from '../actions'
import { deleteId, editorId, errorMessage, saving } from '../state'
import type { Todo, TodoInput } from '../types'
import { DateTimePicker } from './DateTimePicker'
import { Dialog } from './Dialog'
import { blankSubtask, type SubtaskDraft, Subtasks } from './Subtasks'

type Draft = {
  title: string
  description: string
  scheduleDate: string
  scheduleTime: string
  dueDate: string
  dueTime: string
  tags: string
}

export function TodoEditor({ todo }: { todo?: Todo }) {
  // Initialize once per editor. Server refreshes must not overwrite unsaved edits.
  const [draft, setDraft] = useState<Draft>(() => ({
    title: todo?.title ?? '',
    description: todo?.description ?? '',
    scheduleDate: todo?.scheduleDate ?? '',
    scheduleTime: todo?.scheduleTime ?? '',
    dueDate: todo?.dueDate ?? '',
    dueTime: todo?.dueTime ?? '',
    tags: todo?.tags.join(', ') ?? '',
  }))

  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(() => [
    ...(todo?.subtodos ?? []).map((child) => ({
      key: child.id,
      id: child.id,
      title: child.title,
      completed: child.completed,
    })),
    blankSubtask(),
  ])

  function field(name: keyof Draft, value: string) {
    setDraft((current) => ({
      ...current,
      [name]: value,
      ...(name === 'scheduleDate' && !value ? { scheduleTime: '' } : {}),
      ...(name === 'dueDate' && !value ? { dueTime: '' } : {}),
    }))
  }

  async function save() {
    const input: TodoInput = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      scheduleDate: draft.scheduleDate || null,
      scheduleTime: draft.scheduleDate ? draft.scheduleTime || null : null,
      dueDate: draft.dueDate || null,
      dueTime: draft.dueDate ? draft.dueTime || null : null,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      subtodos: subtasks
        .filter((child) => child.title.trim())
        .map(({ id, title, completed }) => ({
          id,
          title: title.trim(),
          completed,
        })),
    }
    if (!input.title) return
    const success = todo
      ? await updateTodo(todo.id, input)
      : await createTodo(input)
    if (success) editorId.value = null
  }

  return (
    <Dialog
      title={todo ? 'Edit todo' : 'New todo'}
      busy={saving.value}
      onDismiss={() => {
        editorId.value = null
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <label>
          Title
          <input
            name="title"
            readOnly={saving.value}
            required
            autoFocus
            value={draft.title}
            onInput={(event) => field('title', event.currentTarget.value)}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            readOnly={saving.value}
            placeholder="Add a description…"
            value={draft.description}
            onInput={(event) => field('description', event.currentTarget.value)}
          />
        </label>
        <div class="modal-dates">
          <div class="min-w-0">
            <span class="text-[0.75rem] font-bold tracking-[0.04em] text-[#666] uppercase">
              Schedule
            </span>
            <DateTimePicker
              label="Schedule"
              date={draft.scheduleDate}
              time={draft.scheduleTime}
              disabled={saving.value}
              onChange={({ date, time }) => {
                setDraft((current) => ({
                  ...current,
                  scheduleDate: date,
                  scheduleTime: time,
                }))
                return true
              }}
            />
          </div>
          <div class="min-w-0">
            <span class="text-[0.75rem] font-bold tracking-[0.04em] text-[#666] uppercase">
              Due
            </span>
            <DateTimePicker
              label="Due"
              date={draft.dueDate}
              time={draft.dueTime}
              disabled={saving.value}
              onChange={({ date, time }) => {
                setDraft((current) => ({
                  ...current,
                  dueDate: date,
                  dueTime: time,
                }))
                return true
              }}
            />
          </div>
        </div>
        <label>
          Tags
          <input
            name="tags"
            readOnly={saving.value}
            placeholder="work, errands"
            value={draft.tags}
            onInput={(event) => field('tags', event.currentTarget.value)}
          />
        </label>
        <Subtasks
          rows={subtasks}
          onChange={setSubtasks}
          disabled={saving.value}
        />
        {!deleteId.value && errorMessage.value && (
          <p class="error-message" role="alert">
            {errorMessage.value}
          </p>
        )}
        <footer>
          <button
            type="button"
            class="delete-button"
            disabled={saving.value}
            onClick={() => {
              if (todo) {
                errorMessage.value = ''
                deleteId.value = todo.id
              } else editorId.value = null
            }}
          >
            {todo ? 'Delete' : 'Cancel'}
          </button>
          <button
            type="submit"
            class="new-button"
            disabled={saving.value || !draft.title.trim()}
          >
            {saving.value ? 'Saving…' : todo ? 'Save changes' : 'Create todo'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
