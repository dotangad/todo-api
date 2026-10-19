import autoAnimate from '@formkit/auto-animate'
import type { ComponentChildren } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

/** Animate direct, stably keyed children without animating the surrounding UI. */
export function AnimatedList({
  children,
  class: className,
}: {
  children: ComponentChildren
  class?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let controller: ReturnType<typeof autoAnimate> | undefined

    const syncMotion = () => {
      controller?.destroy?.()
      controller = motion.matches
        ? undefined
        : autoAnimate(element, { duration: 200, easing: 'ease-out' })
    }

    syncMotion()
    motion.addEventListener('change', syncMotion)
    return () => {
      motion.removeEventListener('change', syncMotion)
      controller?.destroy?.()
    }
  }, [])

  return (
    <div ref={ref} class={className}>
      {children}
    </div>
  )
}
