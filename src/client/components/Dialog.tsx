import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

type Props = {
  title: string
  onDismiss: () => void
  busy?: boolean
  className?: string
  headerClassName?: string
  closeButtonClassName?: string
  children: ComponentChildren
}

export function Dialog({
  title,
  onDismiss,
  busy = false,
  className,
  headerClassName,
  closeButtonClassName,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      class={className ?? 'todo-modal'}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onDismiss()
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onDismiss()
      }}
    >
      <header class={headerClassName}>
        <strong>{title}</strong>
        <button
          type="button"
          class={closeButtonClassName ?? 'icon-button'}
          aria-label={`Close ${title}`}
          disabled={busy}
          onClick={onDismiss}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  )
}
