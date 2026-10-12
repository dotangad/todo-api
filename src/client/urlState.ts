import { batch, effect } from '@preact/signals'
import { sortMode, tagFilter, tagMatch, view } from './state'

type UIState = {
  view: typeof view.value
  tags: string[]
  match: typeof tagMatch.value
  sort: typeof sortMode.value
}

export function readUrlState(url: URL): UIState {
  const params = url.searchParams
  const sort = params.get('sort')
  return {
    view: params.get('view') === 'board' ? 'board' : 'table',
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
    match: params.get('match') === 'any' ? 'any' : 'all',
    sort:
      sort === 'due-asc' ||
      sort === 'due-desc' ||
      sort === 'schedule-asc' ||
      sort === 'schedule-desc'
        ? sort
        : 'created',
  }
}

export function writeUrlState(url: URL, state: UIState): URL {
  const next = new URL(url.href)
  for (const key of ['view', 'tag', 'match', 'sort'])
    next.searchParams.delete(key)
  if (state.view !== 'table') next.searchParams.set('view', state.view)
  for (const tag of state.tags) next.searchParams.append('tag', tag)
  if (state.match !== 'all') next.searchParams.set('match', state.match)
  if (state.sort !== 'created') next.searchParams.set('sort', state.sort)
  return next
}

export function startUrlSync() {
  function restore() {
    const state = readUrlState(new URL(window.location.href))
    batch(() => {
      view.value = state.view
      tagFilter.value = state.tags
      tagMatch.value = state.match
      sortMode.value = state.sort
    })
  }

  restore()
  const stop = effect(() => {
    const next = writeUrlState(new URL(window.location.href), {
      view: view.value,
      tags: tagFilter.value,
      match: tagMatch.value,
      sort: sortMode.value,
    })
    if (next.href !== window.location.href)
      window.history.replaceState(window.history.state, '', next.href)
  })
  window.addEventListener('popstate', restore)
  return () => {
    stop()
    window.removeEventListener('popstate', restore)
  }
}
