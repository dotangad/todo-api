type KeyEvent = Pick<
  KeyboardEvent,
  | 'key'
  | 'repeat'
  | 'isComposing'
  | 'defaultPrevented'
  | 'ctrlKey'
  | 'altKey'
  | 'metaKey'
  | 'shiftKey'
>

export function isNewTodoHotkey(
  event: KeyEvent,
  modalOpen: boolean,
  editableFocused: boolean,
) {
  return (
    event.key.toLowerCase() === 'n' &&
    !event.repeat &&
    !event.isComposing &&
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !modalOpen &&
    !editableFocused
  )
}
