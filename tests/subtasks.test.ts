import { expect, test } from 'bun:test'
import type { VNode } from 'preact'
import { Subtasks } from '../src/client/components/Subtasks'

function inputs(tree: unknown): VNode<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(inputs)
  if (!tree || typeof tree !== 'object' || !('type' in tree)) return []
  const node = tree as VNode<Record<string, unknown>>
  return [
    ...(node.props.type === 'text' ? [node] : []),
    ...inputs(node.props.children),
  ]
}

test('completed subtask titles are muted and struck through but remain editable', () => {
  const rows = [
    { key: 'done', title: 'Finished', completed: true },
    { key: 'open', title: 'Pending', completed: false },
    { key: 'blank', title: '', completed: false },
  ]
  const render = () =>
    inputs(Subtasks({ rows, onChange: () => {}, disabled: false }))

  const titles = render()
  expect(titles.map((node) => node.props.class)).toEqual([
    'done',
    undefined,
    undefined,
  ])
  expect(titles[0].props.readOnly).toBe(false)
  expect(titles[0].props.disabled).toBeUndefined()

  rows[0].completed = false
  expect(render()[0].props.class).toBeUndefined()
})
