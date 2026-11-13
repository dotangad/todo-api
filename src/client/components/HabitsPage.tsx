import { Check, ChevronLeft, ChevronRight } from 'lucide-preact'
import { useState } from 'preact/hooks'
import type { Habit } from '../../habitTypes'
import { dateKey } from '../dates'
import {
  createHabit,
  deleteHabit,
  habitError,
  habitSaving,
  habits,
  monthDays,
  renameHabit,
  setHabitCompletion,
  shiftMonth,
} from '../habits'
import { Dialog } from './Dialog'

function HabitEditor({
  habit,
  onClose,
}: {
  habit: Habit
  onClose: () => void
}) {
  const [title, setTitle] = useState(habit.title)
  const [deleting, setDeleting] = useState(false)
  return (
    <Dialog
      title={deleting ? 'Delete habit?' : 'Edit habit'}
      busy={habitSaving.value}
      onDismiss={onClose}
    >
      <form
        class="habit-editor"
        onSubmit={async (event) => {
          event.preventDefault()
          const saved = deleting
            ? await deleteHabit(habit.id)
            : await renameHabit(habit.id, title)
          if (saved) onClose()
        }}
      >
        {deleting ? (
          <p>
            Delete “{habit.title}” and all its day logs? This cannot be undone.
          </p>
        ) : (
          <label>
            Habit
            <input
              autoFocus
              required
              value={title}
              onInput={(event) => setTitle(event.currentTarget.value)}
              disabled={habitSaving.value}
            />
          </label>
        )}
        {habitError.value && (
          <p role="alert" class="habit-error">
            {habitError.value}
          </p>
        )}
        <footer class="habit-controls">
          {!deleting && (
            <button
              type="button"
              class="topbar-action topbar-action--secondary habit-delete"
              disabled={habitSaving.value}
              onClick={() => setDeleting(true)}
            >
              Delete habit
            </button>
          )}
          <button
            type="button"
            class="topbar-action topbar-action--secondary"
            disabled={habitSaving.value}
            onClick={() => (deleting ? setDeleting(false) : onClose())}
          >
            Cancel
          </button>
          <button
            type="submit"
            class={`new-button ${deleting ? 'habit-delete-confirm' : ''}`}
            disabled={habitSaving.value || (!deleting && !title.trim())}
          >
            {habitSaving.value ? 'Saving…' : deleting ? 'Delete habit' : 'Save'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}

export function HabitTable({
  month,
  today,
  onEdit,
}: {
  month: string
  today: string
  onEdit: (habit: Habit) => void
}) {
  const days = monthDays(month)
  return (
    <section
      class="habit-table-scroll"
      aria-label="Habit completions"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide grid.
      tabIndex={0}
    >
      <table class="habit-table">
        <caption>
          Completions for {month}. Select a day to mark or undo a completion.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="habit-name">
              Habit
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                class={day === today ? 'habit-today' : ''}
                aria-current={day === today ? 'date' : undefined}
              >
                <span>
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
                    weekday: 'narrow',
                    timeZone: 'UTC',
                  })}
                </span>
                <time dateTime={day}>{Number(day.slice(-2))}</time>
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {habits.value.map((habit) => {
            const logs = new Set(habit.logs)
            return (
              <tr key={habit.id}>
                <th scope="row" class="habit-name">
                  <button
                    type="button"
                    class="habit-title"
                    title="Edit habit"
                    disabled={habitSaving.value}
                    onClick={() => onEdit(habit)}
                  >
                    {habit.title}
                  </button>
                </th>
                {days.map((day) => (
                  <td key={day} class={day === today ? 'habit-today' : ''}>
                    <button
                      type="button"
                      class={`habit-cell ${logs.has(day) ? 'is-complete' : ''}`}
                      aria-label={`${habit.title}, ${day}`}
                      aria-pressed={logs.has(day)}
                      title={`${day}: ${logs.has(day) ? 'Completed — click to undo' : 'Mark complete'}`}
                      disabled={habitSaving.value}
                      onClick={() =>
                        void setHabitCompletion(habit.id, day, !logs.has(day))
                      }
                    >
                      {logs.has(day) ? (
                        <Check size={17} aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">·</span>
                      )}
                    </button>
                  </td>
                ))}
                <td class="habit-total">
                  {days.filter((day) => logs.has(day)).length}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export function HabitsPage() {
  const today = dateKey(new Date())
  const [month, setMonth] = useState(today.slice(0, 7))
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<Habit | null>(null)
  return (
    <>
      <header class="topbar habits-topbar">
        <h1>Habits</h1>
        <nav aria-label="Workspace" class="habit-controls">
          <a class="topbar-action topbar-action--secondary" href="/">
            Todos
          </a>
          <a class="topbar-action topbar-action--secondary" href="/notes">
            Notes
          </a>
        </nav>
      </header>
      <p class="habit-intro">
        Small steps, every day. Click a day to log a completion, or click again
        to undo.
      </p>
      <form
        class="habit-create"
        onSubmit={async (event) => {
          event.preventDefault()
          if (await createHabit(title)) setTitle('')
        }}
      >
        <label class="sr-only" for="new-habit">
          New habit
        </label>
        <input
          id="new-habit"
          placeholder="A habit to build, e.g. Read for 20 minutes"
          required
          value={title}
          disabled={habitSaving.value}
          onInput={(event) => setTitle(event.currentTarget.value)}
        />
        <button
          class="new-button"
          type="submit"
          disabled={habitSaving.value || !title.trim()}
        >
          Add habit
        </button>
      </form>
      <div class="habit-month habit-controls">
        <button
          class="topbar-action topbar-action--secondary"
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <label class="sr-only" for="habit-month">
          Month
        </label>
        <input
          id="habit-month"
          type="month"
          min="0001-01"
          max="9999-12"
          value={month}
          onInput={(event) => {
            const value = event.currentTarget.value
            if (monthDays(value).length) setMonth(value)
          }}
        />
        <button
          class="topbar-action topbar-action--secondary"
          type="button"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button
          class="topbar-action topbar-action--secondary"
          type="button"
          onClick={() => setMonth(dateKey(new Date()).slice(0, 7))}
        >
          This month
        </button>
        <span class="habit-hint">Click a habit’s name to edit it.</span>
      </div>
      {!editing && habitError.value && (
        <p class="habit-error" role="alert">
          {habitError.value}
        </p>
      )}
      {habits.value.length ? (
        <HabitTable
          month={month}
          today={today}
          onEdit={(habit) => {
            habitError.value = ''
            setEditing(habit)
          }}
        />
      ) : (
        <section class="habits-empty">
          <h2>Start with one small habit</h2>
          <p>Add a habit above, then track your days here.</p>
        </section>
      )}
      {editing && (
        <HabitEditor
          key={editing.id}
          habit={editing}
          onClose={() => {
            habitError.value = ''
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
