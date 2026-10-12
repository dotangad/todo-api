export type Todo = {
  id: string
  title: string
  description: string | null
  completed: boolean
  parentId: string | null
  scheduleDate: string | null
  scheduleTime: string | null
  dueDate: string | null
  dueTime: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  subtodos?: Todo[]
}

export type SubtodoInput = { id?: string; title: string; completed?: boolean }

export type TodoChanges = Partial<
  Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'subtodos'>
> & { subtodos?: SubtodoInput[] }

export type TodoInput = TodoChanges & { title: string }
