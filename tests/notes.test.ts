import { afterEach, expect, test } from 'bun:test'
import type { VNode } from 'preact'
import { NoteCard } from '../src/client/components/NoteCard'
import { TodoBoard } from '../src/client/components/TodoBoard'
import {
  createNote,
  deleteNote,
  noteDragType,
  noteEditorId,
  noteError,
  noteSaving,
  notes,
  orderedNotes,
  updateNote,
} from '../src/client/notes'
import { boardWeek, statusMode, tagFilter } from '../src/client/state'
import type { Note } from '../src/noteTypes'

const originalFetch = globalThis.fetch
const note = (id: string, changes: Partial<Note> = {}): Note => ({
  id,
  title: id,
  content: 'Content',
  color: 'default',
  scheduleDate: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...changes,
})
function nodes(tree: unknown): VNode<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object' || !('type' in tree)) return []
  const node = tree as VNode<Record<string, unknown>>
  return [node, ...nodes(node.props.children)]
}
afterEach(() => {
  globalThis.fetch = originalFetch
  notes.value = []
  noteSaving.value = false
  noteError.value = ''
  noteEditorId.value = null
  boardWeek.value = null
  statusMode.value = 'all'
  tagFilter.value = []
})

test('notes sort newest edited first, without mutating source order', () => {
  notes.value = [
    note('old'),
    note('new', { updatedAt: '2026-02-01T00:00:00.000Z' }),
  ]
  expect(orderedNotes.value.map((item) => item.id)).toEqual(['new', 'old'])
  expect(notes.value.map((item) => item.id)).toEqual(['old', 'new'])
})

test('dated notes appear once in their board day, independent of todo filters', () => {
  boardWeek.value = '2026-10-11'
  statusMode.value = 'done'
  tagFilter.value = ['work']
  notes.value = [
    note('scheduled', { scheduleDate: '2026-10-13' }),
    note('undated'),
    note('next-week', { scheduleDate: '2026-10-20' }),
  ]
  let tree = nodes(TodoBoard())
  expect(
    tree
      .filter((node) => node.type === NoteCard)
      .map((node) => (node.props.note as Note).id),
  ).toEqual(['scheduled'])
  const tuesday = tree.find(
    (node) => node.props['data-drop-day'] === '2026-10-13',
  )
  expect(
    nodes(tuesday).find((node) => node.type === 'span')?.props.children,
  ).toBe(1)
  expect(
    nodes(tuesday).find((node) => node.type === NoteCard)?.props.board,
  ).toBe(true)
  notes.value = notes.value.map((item) => ({ ...item, scheduleDate: null }))
  tree = nodes(TodoBoard())
  expect(tree.filter((node) => node.type === NoteCard)).toHaveLength(0)
})

test('note creation, date changes, and deletion update local data without a second request', async () => {
  const calls: Array<{ path: string; options?: RequestInit }> = []
  globalThis.fetch = (async (path, options) => {
    calls.push({ path: String(path), options })
    return options?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : Response.json(note('created', JSON.parse(String(options?.body))))
  }) as typeof fetch
  expect(
    await createNote({
      title: 'Draft',
      content: '',
      color: 'blue',
      scheduleDate: '2026-10-13',
    }),
  ).toBe(true)
  expect(notes.value[0].scheduleDate).toBe('2026-10-13')
  expect(await updateNote('created', { scheduleDate: null })).toBe(true)
  expect(notes.value[0].scheduleDate).toBeNull()
  expect(await deleteNote('created')).toBe(true)
  expect(notes.value).toEqual([])
  expect(calls.map((call) => [call.path, call.options?.method])).toEqual([
    ['/api/notes', 'POST'],
    ['/api/notes/created', 'PATCH'],
    ['/api/notes/created', 'DELETE'],
  ])
})

test('failed saves retain the note/editor, show the error, and release the write guard', async () => {
  notes.value = [note('saved')]
  noteEditorId.value = 'saved'
  globalThis.fetch = (async () =>
    Response.json(
      { error: { message: 'Invalid date.' } },
      { status: 400 },
    )) as typeof fetch
  expect(await updateNote('saved', { scheduleDate: 'bad' })).toBe(false)
  expect(notes.value[0]).toEqual(note('saved'))
  expect(noteEditorId.value).toBe('saved')
  expect(noteError.value).toBe('Invalid date.')
  expect(noteSaving.value).toBe(false)
  globalThis.fetch = (async () => {
    throw new Error('Offline')
  }) as typeof fetch
  expect(await deleteNote('saved')).toBe(false)
  expect(noteError.value).toBe('Offline')
  expect(notes.value).toHaveLength(1)
})

test('board note drops call the notes API, not the todos API', async () => {
  boardWeek.value = '2026-10-11'
  notes.value = [note('dragged', { scheduleDate: '2026-10-13' })]
  const calls: string[] = []
  globalThis.fetch = (async (path, options) => {
    calls.push(String(path))
    expect(JSON.parse(String(options?.body))).toEqual({
      scheduleDate: '2026-10-14',
    })
    return Response.json(note('dragged', { scheduleDate: '2026-10-14' }))
  }) as typeof fetch
  const column = nodes(TodoBoard()).find(
    (node) => node.props['data-drop-day'] === '2026-10-14',
  )
  const onDrop = column?.props.onDrop as (event: unknown) => void
  onDrop({
    preventDefault() {},
    dataTransfer: {
      getData: (type: string) => (type === noteDragType ? 'dragged' : ''),
    },
  })
  await Bun.sleep(0)
  expect(calls).toEqual(['/api/notes/dragged'])
  expect(notes.value[0].scheduleDate).toBe('2026-10-14')
})

test('concurrent note writes are guarded', async () => {
  noteSaving.value = true
  globalThis.fetch = (() => {
    throw new Error('Must not fetch')
  }) as typeof fetch
  expect(await updateNote('saved', { title: 'Changed' })).toBe(false)
  expect(noteError.value).toBe('')
})
