import { deleteId, editorId, findTodo } from '../state'
import { DeleteDialog } from './DeleteDialog'
import { TodoEditor } from './TodoEditor'

export function ModalLayer() {
  const editing = editorId.value
  const todo = editing && editing !== 'new' ? findTodo(editing) : undefined
  const deleting = deleteId.value ? findTodo(deleteId.value) : undefined

  return (
    <>
      {editing && (editing === 'new' || todo) && (
        <TodoEditor key={editing} todo={todo} />
      )}
      {deleting && <DeleteDialog key={deleting.id} todo={deleting} />}
    </>
  )
}
