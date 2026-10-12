import { expect, test } from 'bun:test'
import { isNewTodoHotkey } from '../src/client/newTodoHotkey'

const key = {
  key: 'n',
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
}

test('N opens a new todo only without a modal or editable focus', () => {
  expect(isNewTodoHotkey(key, false, false)).toBe(true)
  expect(isNewTodoHotkey(key, true, false)).toBe(false)
  expect(isNewTodoHotkey(key, false, true)).toBe(false)
})

test('ignores other keys, modifiers, repeats and composition', () => {
  for (const change of [
    { key: 'x' },
    { repeat: true },
    { isComposing: true },
    { defaultPrevented: true },
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { shiftKey: true },
  ]) {
    expect(isNewTodoHotkey({ ...key, ...change }, false, false)).toBe(false)
  }
})
