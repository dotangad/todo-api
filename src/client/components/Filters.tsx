import {
  clearFilters,
  sortMode,
  statusMode,
  tagFilter,
  tagMatch,
  view,
} from '../state'
import { SortFilter } from './SortFilter'
import { StatusFilter } from './StatusFilter'
import { TagFilter } from './TagFilter'
import { WeekFilter } from './WeekFilter'

export function Filters() {
  return (
    <section class="filters" aria-label="Todo filters">
      {(tagFilter.value.length > 0 ||
        tagMatch.value !== 'all' ||
        sortMode.value !== 'created' ||
        statusMode.value !== 'all') && (
        <button type="button" class="clear-filters" onClick={clearFilters}>
          Clear
        </button>
      )}
      {view.value === 'board' && <WeekFilter />}
      <StatusFilter />
      <TagFilter />
      <SortFilter />
    </section>
  )
}
