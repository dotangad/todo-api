import { updateTodo } from '../actions'
import { cn } from '../cn'
import { openEditor, saving, visibleTodos } from '../state'
import type { Todo } from '../types'
import { TodoDateCell } from './TodoDateCell'

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <div class="todo-row">
      <div class="name-cell">
        <input
          type="checkbox"
          checked={todo.completed}
          disabled={saving.value}
          aria-label={`Complete ${todo.title}`}
          onChange={(event) => {
            void updateTodo(todo.id, { completed: event.currentTarget.checked })
          }}
        />
        <button
          type="button"
          class={cn('todo-title', { done: todo.completed })}
          onClick={() => openEditor(todo.id)}
        >
          {todo.title}
        </button>
      </div>
      <span>
        <button
          type="button"
          class={cn(
            'status',
            todo.completed && 'bg-success text-success-foreground',
          )}
          disabled={saving.value}
          onClick={() => {
            void updateTodo(todo.id, { completed: !todo.completed })
          }}
        >
          {todo.completed ? 'Done' : 'Open'}
        </button>
      </span>
      <TodoDateCell todo={todo} kind="schedule" />
      <TodoDateCell todo={todo} kind="due" />
      <span class="tag-list">
        {todo.tags.map((tag) => (
          <i key={tag}>{tag}</i>
        ))}
      </span>
    </div>
  )
}

export function TodoTable() {
  return (
    <section class="table-wrap" aria-label="Todo database">
      <div class="database-head">
        <span>Name</span>
        <span>Status</span>
        <span>Schedule</span>
        <span>Due</span>
        <span>Tags</span>
      </div>
      {visibleTodos.value.map((todo) => (
        <TodoRow key={todo.id} todo={todo} />
      ))}
      {!visibleTodos.value.length && (
        <p class="empty">
          No matching todos. Create one or clear your filters.
        </p>
      )}
    </section>
  )
}
