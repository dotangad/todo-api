import { updateTodo } from '../actions'
import { saving } from '../state'
import type { Todo } from '../types'
import { DateTimePicker } from './DateTimePicker'

export function TodoDateCell({
  todo,
  kind,
}: {
  todo: Todo
  kind: 'schedule' | 'due'
}) {
  const dateField = `${kind}Date` as const
  const timeField = `${kind}Time` as const
  const label = kind === 'schedule' ? 'Schedule' : 'Due'

  return (
    <DateTimePicker
      style={{
        setClass: kind === 'due' ? 'text-red-500 font-bold uppercase' : '',
      }}
      label={`${label} for ${todo.title}`}
      date={todo[dateField] ?? ''}
      time={todo[timeField] ?? ''}
      disabled={saving.value}
      onChange={({ date, time }) =>
        updateTodo(todo.id, {
          [dateField]: date || null,
          [timeField]: date ? time || null : null,
        })
      }
    />
  )
}
