import { expect, test } from 'bun:test'
import { boardWeek, view } from '../src/client/state'
import { startUrlSync } from '../src/client/urlState'

test('restores, persists, and navigates board weeks through the URL', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const events = new EventTarget()
  const mockWindow = {
    location: {
      href: 'https://example.test/?view=board&week=2027-01-03&source=share#section',
    },
    history: {
      state: null,
      replaceState(_state: unknown, _title: string, url: string) {
        mockWindow.location.href = url
      },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  })
  let stop: (() => void) | undefined
  try {
    view.value = 'table'
    boardWeek.value = null
    stop = startUrlSync()
    expect(view.value).toBe('board')
    expect(boardWeek.value).toBe('2027-01-03')

    boardWeek.value = '2027-01-10'
    expect(new URL(mockWindow.location.href).searchParams.get('week')).toBe(
      '2027-01-10',
    )
    view.value = 'table'
    expect(new URL(mockWindow.location.href).searchParams.get('week')).toBe(
      '2027-01-10',
    )
    expect(new URL(mockWindow.location.href).searchParams.get('source')).toBe(
      'share',
    )
    expect(new URL(mockWindow.location.href).hash).toBe('#section')

    mockWindow.location.href =
      'https://example.test/?view=board&week=2027-01-03'
    events.dispatchEvent(new Event('popstate'))
    expect(view.value).toBe('board')
    expect(boardWeek.value).toBe('2027-01-03')

    boardWeek.value = null
    expect(new URL(mockWindow.location.href).searchParams.has('week')).toBe(
      false,
    )
  } finally {
    stop?.()
    boardWeek.value = null
    view.value = 'table'
    if (previousWindow)
      Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
