import { updateTodo } from '../actions'
import { dayLabel, weekDays } from '../dates'
import { saving, visibleTodos } from '../state'
import { TodoCard } from './TodoCard'

export function TodoBoard() {
  const todos = visibleTodos.value
  console.log(todos.map((x) => x.scheduleTime))
  return (
    <div class="board-scroll">
      <section class="board" aria-label="Scheduled todos board">
        {weekDays().map((day) => {
          const scheduled = todos.filter((todo) => todo.scheduleDate === day)
          return (
            <section
              key={day}
              class="day-column"
              aria-label={dayLabel(day)}
              data-drop-day={day}
              onDragOver={(event) => {
                if (saving.value) return
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const id = event.dataTransfer?.getData('text/plain')
                if (id) void updateTodo(id, { scheduleDate: day })
              }}
            >
              <header>
                <strong>{dayLabel(day)}</strong>
                <span>{scheduled.length}</span>
              </header>
              <div class="drop-zone">
                {/* TODOs without a scheduleTime are displayed below scheduled TODOs */}
                {scheduled
                  .filter((x) => !!x.scheduleTime)
                  .map((todo) => (
                    <TodoCard key={todo.id} todo={todo} />
                  ))}
                {scheduled
                  .filter((x) => !x.scheduleTime)
                  .map((todo) => (
                    <TodoCard key={todo.id} todo={todo} />
                  ))}
              </div>
            </section>
          )
        })}
      </section>
    </div>
  )
}
