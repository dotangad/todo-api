import { updateTodo } from '../actions'
import { dayLabel, weekDays } from '../dates'
import { boardWeek, saving, visibleTodos } from '../state'
import { AnimatedList } from './AnimatedList'
import { TodoCard } from './TodoCard'

export function TodoBoard() {
  const todos = visibleTodos.value
  const days = weekDays(
    boardWeek.value ? new Date(`${boardWeek.value}T12:00:00`) : undefined,
  )

  return (
    <div class="board-scroll">
      <section class="board" aria-label="Scheduled todos board">
        {days.map((day) => {
          const scheduled = todos.filter(
            (todo) => todo.scheduleDate === day && todo.dueDate !== day,
          )
          const due = todos.filter((todo) => todo.dueDate === day)
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
                <span>{scheduled.length + due.length}</span>
              </header>
              <AnimatedList class="drop-zone">
                {due.map((todo) => (
                  <TodoCard key={todo.id} todo={todo} draggable={false} />
                ))}
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
              </AnimatedList>
            </section>
          )
        })}
      </section>
    </div>
  )
}
