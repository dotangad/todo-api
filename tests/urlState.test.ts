import { describe, expect, test } from 'bun:test'
import { readUrlState, writeUrlState } from '../src/client/urlState'

describe('UI state in URL', () => {
  test('defaults to the table with no filters and newest-first sorting', () => {
    expect(readUrlState(new URL('https://example.test/'))).toEqual({
      view: 'table',
      tags: [],
      match: 'all',
      sort: 'created',
    })
  })

  test('round-trips multiple tags, match mode, sort, view, and special characters', () => {
    const source = new URL('https://example.test/?source=share#section')
    const saved = writeUrlState(source, {
      view: 'board',
      tags: ['home & garden', 'work/ops'],
      match: 'any',
      sort: 'schedule-asc',
    })
    expect(saved.searchParams.getAll('tag')).toEqual([
      'home & garden',
      'work/ops',
    ])
    expect(saved.searchParams.get('source')).toBe('share')
    expect(saved.hash).toBe('#section')
    expect(readUrlState(saved)).toEqual({
      view: 'board',
      tags: ['home & garden', 'work/ops'],
      match: 'any',
      sort: 'schedule-asc',
    })
    expect(source.search).toBe('?source=share')
  })

  test('clears app params on reset without dropping unrelated params or hash', () => {
    const url = new URL(
      'https://example.test/?source=share&tag=old&view=board&sort=due-desc&match=any#section',
    )
    const reset = writeUrlState(url, {
      view: 'table',
      tags: [],
      match: 'all',
      sort: 'created',
    })
    expect(reset.href).toBe('https://example.test/?source=share#section')
  })

  test('ignores invalid values and deduplicates selected tags', () => {
    expect(
      readUrlState(
        new URL(
          'https://example.test/?view=unknown&tag=work&tag=work&tag=&match=neither&sort=invalid',
        ),
      ),
    ).toEqual({ view: 'table', tags: ['work'], match: 'all', sort: 'created' })
  })
})
