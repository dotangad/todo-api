import { Check, ChevronDown, Tags } from 'lucide-preact'
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { tagFilter, tagMatch, tags } from '../state'

export function TagFilter() {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = tagFilter.value
  const available = tags.value

  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const button = trigger.current
      const popover = panel.current
      if (!button || !popover) return
      const bounds = button.getBoundingClientRect()
      const gap = 8
      popover.style.left = `${Math.max(gap, Math.min(bounds.right - popover.offsetWidth, window.innerWidth - popover.offsetWidth - gap))}px`
      popover.style.top = `${Math.max(gap, Math.min(bounds.bottom + gap + popover.offsetHeight <= window.innerHeight - gap ? bounds.bottom + gap : bounds.top - popover.offsetHeight - gap, window.innerHeight - popover.offsetHeight - gap))}px`
    }
    position()
    const observer = new ResizeObserver(position)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  function toggle(tag: string) {
    tagFilter.value = selected.includes(tag)
      ? selected.filter((item) => item !== tag)
      : [...selected, tag]
  }

  return (
    <div class="tag-filter">
      <button
        ref={trigger}
        type="button"
        class="tag-filter-trigger"
        popoverTarget={id}
        aria-label={
          selected.length
            ? `Tags: ${selected.join(', ')}; match ${tagMatch.value}`
            : 'Tags: all'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
      >
        <Tags size={16} aria-hidden="true" />
        <span>
          {selected.length ? `Tags (${selected.length})` : 'All tags'}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Filter by tags"
        class="tag-filter-popover"
        onToggle={(event) => setOpen(event.newState === 'open')}
      >
        <div class="tag-filter-heading">
          <strong>Filter by tags</strong>
          <fieldset class="tag-match-switch">
            <legend class="sr-only">Match selected tags</legend>
            <button
              type="button"
              class={tagMatch.value === 'all' ? 'active' : ''}
              aria-label="Match all selected tags"
              title="Match all selected tags"
              aria-pressed={tagMatch.value === 'all'}
              onClick={() => {
                tagMatch.value = 'all'
              }}
            >
              &amp;
            </button>
            <button
              type="button"
              class={tagMatch.value === 'any' ? 'active' : ''}
              aria-label="Match any selected tag"
              title="Match any selected tag"
              aria-pressed={tagMatch.value === 'any'}
              onClick={() => {
                tagMatch.value = 'any'
              }}
            >
              Ⅱ
            </button>
          </fieldset>
        </div>
        {available.length ? (
          <div class="tag-filter-options">
            {available.map((tag) => (
              <label class="tag-option" key={tag}>
                <input
                  type="checkbox"
                  checked={selected.includes(tag)}
                  onChange={() => toggle(tag)}
                />
                <span>{tag}</span>
                {selected.includes(tag) && (
                  <Check size={15} aria-hidden="true" />
                )}
              </label>
            ))}
          </div>
        ) : (
          <p>No tags yet</p>
        )}
        {selected.length > 0 && (
          <button
            type="button"
            class="tag-filter-clear"
            onClick={() => {
              tagFilter.value = []
              panel.current?.hidePopover()
              trigger.current?.focus({ preventScroll: true })
            }}
          >
            Clear tags
          </button>
        )}
      </div>
    </div>
  )
}
