import { clearFilters, sortMode, tagFilter, tagMatch } from '../state'
import { SortFilter } from './SortFilter'
import { TagFilter } from './TagFilter'

export function Filters() {
  return (
    <section class="filters" aria-label="Todo filters">
      {(tagFilter.value.length > 0 ||
        tagMatch.value !== 'all' ||
        sortMode.value !== 'created') && (
        <button type="button" class="clear-filters" onClick={clearFilters}>
          Clear
        </button>
      )}
      <TagFilter />
      <SortFilter />
    </section>
  )
}
