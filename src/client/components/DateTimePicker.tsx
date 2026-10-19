import { CalendarDays } from 'lucide-preact'
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { cn } from '../cn'
import { dateTimeLabel } from '../dates'

export type DateTimeValue = { date: string; time: string }

export type DateTimePickerStyles = {
  class?: string
  setClass?: string // applied if the DateTime value is set
}

type Props = DateTimeValue & {
  label: string
  disabled?: boolean
  onChange: (value: DateTimeValue) => boolean | Promise<boolean>
  style?: DateTimePickerStyles
}

// The native popover lives in the top layer, outside table overflow clipping.
// Draft changes are only committed with Apply; dismissing leaves the value alone.
export function DateTimePicker({
  date,
  time,
  label,
  disabled = false,
  onChange,
  style,
}: Props) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const timeInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateTimeValue>({ date, time })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const busy = disabled || pending
  const text = dateTimeLabel(date, time)
  const secondary =
    'border-0 bg-transparent p-0 text-[0.8rem] text-muted hover:text-ink disabled:opacity-50'
  const input =
    'box-border min-w-0 w-full rounded-[0.4rem] border border-solid border-[#d8d8d2] bg-white p-2 text-[0.85rem] font-normal tracking-normal text-ink normal-case'

  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const anchor = trigger.current
      const panel = popover.current
      if (!anchor || !panel) return
      const bounds = anchor.getBoundingClientRect()
      const gap = 8
      const left = Math.max(
        gap,
        Math.min(bounds.left, window.innerWidth - panel.offsetWidth - gap),
      )
      const below = bounds.bottom + gap
      const top = Math.max(
        gap,
        Math.min(
          below + panel.offsetHeight <= window.innerHeight - gap
            ? below
            : bounds.top - panel.offsetHeight - gap,
          window.innerHeight - panel.offsetHeight - gap,
        ),
      )
      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
    }
    position()
    dateInput.current?.focus({ preventScroll: true })
    const observer = new ResizeObserver(position)
    if (popover.current) observer.observe(popover.current)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  function close() {
    if (!popover.current?.matches(':popover-open')) return
    popover.current.hidePopover()
    // Wait for the saving state to re-enable the trigger before restoring focus.
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  async function apply() {
    if (busy) return
    if (!dateInput.current?.reportValidity()) return
    if (!timeInput.current?.reportValidity()) return
    setPending(true)
    setError('')
    try {
      const result = await onChange({
        date: draft.date,
        time: draft.date ? draft.time : '',
      })
      if (result === false) setError('Could not save. Please try again.')
      else close()
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div class="min-w-0">
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        aria-label={`${label}: ${text}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        title={text}
        disabled={busy}
        class={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-md border-0 bg-transparent px-1.5 py-2 text-left text-[0.85rem] font-normal tracking-normal normal-case hover:bg-[#efefec] focus-visible:outline-2 focus-visible:outline-offset-2',
          date ? 'text-[#555]' : 'text-muted',
          date ? style?.setClass : '',
          style?.class,
        )}
      >
        <CalendarDays size={14} class="shrink-0" aria-hidden="true" />
        <span class="truncate">{text}</span>
      </button>
      <div
        ref={popover}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        aria-busy={pending}
        class="fixed inset-auto m-0 box-border max-h-[calc(100dvh-1rem)] w-72 max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border border-solid border-[#deded9] bg-white p-4 text-ink shadow-lg"
        onBeforeToggle={(event) => {
          if (event.newState === 'open') {
            setDraft({ date, time: date ? time : '' })
            setError('')
          }
        }}
        onToggle={(event) => setOpen(event.newState === 'open')}
        onKeyDown={(event) => {
          // Do not submit a surrounding todo form from inside the picker.
          if (
            event.key === 'Enter' &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault()
            void apply()
          }
        }}
      >
        <strong class="mb-3 block text-[0.85rem]">{label}</strong>
        <div class="grid gap-3">
          <label class="grid gap-1 text-[0.75rem] font-semibold tracking-normal text-muted normal-case">
            Date
            <input
              ref={dateInput}
              type="date"
              class={input}
              value={draft.date}
              disabled={busy}
              onInput={(event) => {
                const nextDate = event.currentTarget.value
                setDraft((current) => ({
                  date: nextDate,
                  time: nextDate ? current.time : '',
                }))
              }}
            />
          </label>
          <label class="grid gap-1 text-[0.75rem] font-semibold tracking-normal text-muted normal-case">
            Time (optional)
            <input
              ref={timeInput}
              type="time"
              step="1"
              class={input}
              value={draft.time}
              disabled={busy || !draft.date}
              onInput={(event) => {
                const nextTime = event.currentTarget.value
                setDraft((current) => ({ ...current, time: nextTime }))
              }}
            />
          </label>
          <div class="flex justify-between gap-2">
            <button
              type="button"
              class={secondary}
              disabled={busy || !draft.date}
              onClick={() => setDraft({ date: '', time: '' })}
            >
              Clear date
            </button>
            <button
              type="button"
              class={secondary}
              disabled={busy || !draft.time}
              onClick={() => setDraft((current) => ({ ...current, time: '' }))}
            >
              Remove time
            </button>
          </div>
          {error && (
            <p role="alert" class="m-0 text-[0.8rem] text-danger">
              {error}
            </p>
          )}
          <div class="mt-1 flex items-center justify-end gap-3 border-0 border-t border-solid border-[#eee] pt-3">
            <button
              type="button"
              class={secondary}
              disabled={pending}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              class="new-button px-3 py-1.5 text-[0.8rem]"
              disabled={busy}
              onClick={() => void apply()}
            >
              {pending ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
