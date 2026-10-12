import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { updateTodo } from './actions'
import { saving } from './state'

type TouchDrag = {
  x: number
  y: number
  started: boolean
  zone: HTMLElement | null
}

export function useCardDrag(id: string) {
  const [dragging, setDragging] = useState(false)
  const touch = useRef<TouchDrag | null>(null)
  const ignoreClickUntil = useRef(0)

  function clearTouch() {
    touch.current?.zone?.classList.remove('touch-drop-target')
    touch.current = null
  }

  useEffect(() => clearTouch, [])

  const handlers: JSX.IntrinsicElements['article'] = {
    onDragStart(event) {
      if (saving.value || !event.dataTransfer) {
        event.preventDefault()
        return
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
      setDragging(true)
    },
    onDragEnd() {
      setDragging(false)
      ignoreClickUntil.current = Date.now() + 350
    },
    onPointerDown(event) {
      if (
        saving.value ||
        event.pointerType === 'mouse' ||
        (event.target as HTMLElement).closest('input,button')
      )
        return
      touch.current = {
        x: event.clientX,
        y: event.clientY,
        started: false,
        zone: null,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event) {
      const active = touch.current
      if (!active) return
      if (
        !active.started &&
        Math.hypot(event.clientX - active.x, event.clientY - active.y) < 8
      )
        return
      active.started = true
      const zone =
        document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>('[data-drop-day]') ?? null
      if (zone !== active.zone) {
        active.zone?.classList.remove('touch-drop-target')
        zone?.classList.add('touch-drop-target')
        active.zone = zone
      }
    },
    onPointerUp(event) {
      const active = touch.current
      const day = active?.started ? active.zone?.dataset.dropDay : null
      if (active?.started) ignoreClickUntil.current = Date.now() + 350
      clearTouch()
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId)
      if (day) void updateTodo(id, { scheduleDate: day })
    },
    onPointerCancel: clearTouch,
    onLostPointerCapture: clearTouch,
    onClickCapture(event) {
      if (Date.now() < ignoreClickUntil.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }

  return { dragging, handlers }
}
