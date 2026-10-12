import { sortMode } from '../state'

export function SortFilter() {
  return (
    <select
      aria-label="Sort todos"
      value={sortMode.value}
      onChange={(event) => {
        sortMode.value = event.currentTarget.value as typeof sortMode.value
      }}
    >
      <option value="created">Newest first</option>
      <option value="schedule-asc">Scheduled ↑</option>
      <option value="schedule-desc">Scheduled ↓</option>
      <option value="due-asc">Due date ↑</option>
      <option value="due-desc">Due date ↓</option>
    </select>
  )
}
