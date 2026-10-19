import { batch, effect } from '@preact/signals'
import { parseWeekStart, weekDays } from './dates'
import {
  boardWeek,
  sortMode,
  statusMode,
  tagFilter,
  tagMatch,
  view,
} from './state'

type UIState = {
  view: typeof view.value
  tags: string[]
  match: typeof tagMatch.value
  sort: typeof sortMode.value
  status: typeof statusMode.value
  week: typeof boardWeek.value
}

export function readUrlState(url: URL): UIState {
  const params = url.searchParams
  const sort = params.get('sort')
  const status = params.get('status')
  const week = parseWeekStart(params.get('week'))
  return {
    view: params.get('view') === 'board' ? 'board' : 'table',
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
    match: params.get('match') === 'any' ? 'any' : 'all',
    status: status === 'open' || status === 'done' ? status : 'all',
    week: week === weekDays()[0] ? null : week,
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
  for (const key of ['view', 'tag', 'match', 'sort', 'status', 'week'])
    next.searchParams.delete(key)
  if (state.view !== 'table') next.searchParams.set('view', state.view)
  for (const tag of state.tags) next.searchParams.append('tag', tag)
  if (state.match !== 'all') next.searchParams.set('match', state.match)
  if (state.sort !== 'created') next.searchParams.set('sort', state.sort)
  if (state.status !== 'all') next.searchParams.set('status', state.status)
  if (state.week) next.searchParams.set('week', state.week)
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
      statusMode.value = state.status
      boardWeek.value = state.week
    })
  }

  restore()
  const stop = effect(() => {
    const next = writeUrlState(new URL(window.location.href), {
      view: view.value,
      tags: tagFilter.value,
      match: tagMatch.value,
      sort: sortMode.value,
      status: statusMode.value,
      week: boardWeek.value,
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
