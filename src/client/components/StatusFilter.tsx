import { statusMode } from '../state'

export function StatusFilter() {
  return (
    <select
      aria-label="Status Filter"
      value={statusMode.value}
      onChange={(event) => {
        statusMode.value = event.currentTarget.value as typeof statusMode.value
      }}
    >
      <option value="open">Hide Done</option>
      <option value="done">Hide Open</option>
      <option value="all">Show All</option>
    </select>
  )
}
