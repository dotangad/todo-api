import { describe, expect, test } from 'bun:test'
import { cn } from '../src/client/cn'

describe('cn', () => {
  test('combines strings, objects, and nested arrays; ignores falsey values', () => {
    expect(
      cn('card', [false, ['p-2', null]], undefined, {
        done: true,
        active: false,
      }),
    ).toBe('card p-2 done')
    expect(cn()).toBe('')
  })

  test('lets later Tailwind utilities override conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('hover:bg-black bg-white', 'hover:bg-ink')).toBe(
      'bg-white hover:bg-ink',
    )
  })

  test('preserves component classes and merges custom palette utilities', () => {
    expect(
      cn('status bg-white text-ink', 'bg-success text-success-foreground'),
    ).toBe('status bg-success text-success-foreground')
  })
})
