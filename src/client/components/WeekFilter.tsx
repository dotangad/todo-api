import { ArrowBigLeftDash, ArrowBigRightDash } from 'lucide-preact'
import { shiftWeek, weekDays } from '../dates'
import { boardWeek } from '../state'

export function WeekFilter() {
  const days = weekDays(
    boardWeek.value ? new Date(`${boardWeek.value}T12:00:00`) : undefined,
  )

  function navigate(offset: number) {
    const start = shiftWeek(days[0], offset)
    boardWeek.value = start === weekDays()[0] ? null : start
  }

  return (
    <nav
      class="flex flex-wrap items-center justify-center gap-2"
      aria-label="Board week"
    >
      <button
        type="button"
        class="grid size-10 place-items-center rounded-lg border border-solid border-[#d8d8d2] bg-white hover:bg-[#eee]"
        aria-label="Previous week"
        title="Previous week"
        onClick={() => navigate(-1)}
      >
        <ArrowBigLeftDash size={22} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex h-10 items-center justify-center rounded-lg border border-solid border-[#d8d8d2] bg-white px-3 text-xs font-semibold tracking-wider hover:bg-[#eee] disabled:cursor-default disabled:opacity-50"
        disabled={boardWeek.value === null}
        onClick={() => {
          boardWeek.value = null
        }}
      >
        TODAY
      </button>
      <button
        type="button"
        class="grid size-10 place-items-center rounded-lg border border-solid border-[#d8d8d2] bg-white hover:bg-[#eee]"
        aria-label="Next week"
        title="Next week"
        onClick={() => navigate(1)}
      >
        <ArrowBigRightDash size={22} aria-hidden="true" />
      </button>
    </nav>
  )
}
