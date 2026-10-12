import { batch } from '@preact/signals'
import { deleteTodo } from '../actions'
import { deleteId, editorId, errorMessage, saving } from '../state'
import type { Todo } from '../types'
import { Dialog } from './Dialog'

export function DeleteDialog({ todo }: { todo: Todo }) {
  async function confirmDelete() {
    if (await deleteTodo(todo.id)) {
      batch(() => {
        deleteId.value = null
        if (editorId.value === todo.id) editorId.value = null
      })
    }
  }

  return (
    <Dialog
      title="Delete todo?"
      className="max-h-[calc(100vh-2rem)] w-[min(calc(100%-2rem),460px)] overflow-auto rounded-[0.8rem] border-0 bg-white p-0 text-ink shadow-[0_20px_60px_#0005] backdrop:bg-[#16161688]"
      headerClassName="flex items-center justify-between border-b border-solid border-[#eee] px-5 py-[1.1rem] text-[1.1rem]"
      closeButtonClassName="border-0 bg-transparent p-0 text-[1.6rem] leading-none"
      busy={saving.value}
      onDismiss={() => {
        deleteId.value = null
      }}
    >
      <div>
        <div class="px-5 py-5 leading-6">
          <p class="m-0">
            Delete <strong>“{todo.title}”</strong>?
          </p>
          <p class="mt-1.5 mb-0 text-sm text-[#666]">
            {todo.subtodos?.length
              ? 'Its subtasks will also be deleted. This cannot be undone.'
              : 'This cannot be undone.'}
          </p>
          {errorMessage.value && (
            <p class="mt-3 mb-0 text-sm text-danger" role="alert">
              {errorMessage.value}
            </p>
          )}
        </div>
        <footer class="flex items-center justify-end gap-2.5 border-t border-solid border-[#eee] px-5 py-4">
          <button
            type="button"
            autoFocus
            class="min-h-10 rounded-lg border border-solid border-[#d8d8d2] bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas"
            disabled={saving.value}
            onClick={() => {
              deleteId.value = null
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="min-h-10 rounded-lg border border-solid border-danger bg-danger px-3.5 py-2 text-sm font-semibold text-white hover:border-[#8f2626] hover:bg-[#8f2626] disabled:hover:border-danger disabled:hover:bg-danger"
            disabled={saving.value}
            onClick={() => {
              void confirmDelete()
            }}
          >
            {saving.value ? 'Deleting…' : 'Delete todo'}
          </button>
        </footer>
      </div>
    </Dialog>
  )
}
