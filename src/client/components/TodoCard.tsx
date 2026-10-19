import { Clock3 } from 'lucide-preact'
import { updateTodo } from '../actions'
import { cn } from '../cn'
import { dateTimeLabel, timeLabel } from '../dates'
import { openEditor, saving } from '../state'
import type { Todo } from '../types'
import { useCardDrag } from '../useCardDrag'

export function TodoCard({
  todo,
  draggable = true,
}: {
  todo: Todo
  draggable?: boolean
}) {
  const { dragging, handlers } = useCardDrag(todo.id, draggable)
  return (
    <article
      {...handlers}
      class={cn(
        'card',
        !draggable && 'cursor-default touch-auto',
        dragging && 'opacity-[0.35]',
      )}
      draggable={draggable && !saving.value}
    >
      <div class="card-top">
        <div class="name-cell">
          <input
            class="card-checkbox"
            type="checkbox"
            checked={todo.completed}
            disabled={saving.value}
            aria-label={`Complete ${todo.title}`}
            onChange={(event) => {
              void updateTodo(todo.id, {
                completed: event.currentTarget.checked,
              })
            }}
          />
          <button
            type="button"
            class={cn('todo-title', { done: todo.completed })}
            title={todo.title}
            onClick={() => openEditor(todo.id)}
          >
            {todo.title}
          </button>
        </div>
        {todo.scheduleTime && (
          <time
            class="card-schedule"
            dateTime={`${todo.scheduleDate}T${todo.scheduleTime}`}
          >
            <span class="sr-only">Scheduled at </span>
            {timeLabel(todo.scheduleTime)}
            <Clock3 size={14} aria-hidden="true" />
          </time>
        )}
      </div>
      {(todo.tags.length > 0 || todo.dueDate) && (
        <div class="card-meta">
          <div class="card-tags">
            {todo.tags.map((tag) => (
              <i key={tag}>{tag}</i>
            ))}
          </div>
          {todo.dueDate && (
            <time
              class="card-due"
              dateTime={`${todo.dueDate}${todo.dueTime ? `T${todo.dueTime}` : ''}`}
            >
              <span class="sr-only">Due </span>
              {dateTimeLabel(todo.dueDate, todo.dueTime ?? '')}
            </time>
          )}
        </div>
      )}
    </article>
  )
}
