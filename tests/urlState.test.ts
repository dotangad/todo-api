import { describe, expect, test } from 'bun:test'
import { weekDays } from '../src/client/dates'
import { readUrlState, writeUrlState } from '../src/client/urlState'

describe('UI state in URL', () => {
  test('defaults to the table with no filters and newest-first sorting', () => {
    expect(readUrlState(new URL('https://example.test/'))).toEqual({
      view: 'table',
      tags: [],
      match: 'all',
      sort: 'created',
      status: 'all',
      week: null,
    })
  })

  test('round-trips multiple tags, match mode, sort, view, and special characters', () => {
    const source = new URL('https://example.test/?source=share#section')
    const saved = writeUrlState(source, {
      view: 'board',
      tags: ['home & garden', 'work/ops'],
      match: 'any',
      sort: 'schedule-asc',
      status: 'open',
      week: '2027-01-03',
    })
    expect(saved.searchParams.getAll('tag')).toEqual([
      'home & garden',
      'work/ops',
    ])
    expect(saved.searchParams.get('status')).toBe('open')
    expect(saved.searchParams.get('week')).toBe('2027-01-03')
    expect(saved.searchParams.get('source')).toBe('share')
    expect(saved.hash).toBe('#section')
    expect(readUrlState(saved)).toEqual({
      view: 'board',
      tags: ['home & garden', 'work/ops'],
      match: 'any',
      sort: 'schedule-asc',
      status: 'open',
      week: '2027-01-03',
    })
    expect(source.search).toBe('?source=share')
  })

  test('clears app params on reset without dropping unrelated params or hash', () => {
    const url = new URL(
      'https://example.test/?source=share&tag=old&view=board&sort=due-desc&match=any&status=done&week=2027-01-03#section',
    )
    const reset = writeUrlState(url, {
      view: 'table',
      tags: [],
      match: 'all',
      sort: 'created',
      status: 'all',
      week: null,
    })
    expect(reset.href).toBe('https://example.test/?source=share#section')
  })

  test('ignores invalid values and deduplicates selected tags', () => {
    expect(
      readUrlState(
        new URL(
          'https://example.test/?view=unknown&tag=work&tag=work&tag=&match=neither&sort=invalid&status=invalid&week=2026-02-30',
        ),
      ),
    ).toEqual({
      view: 'table',
      tags: ['work'],
      match: 'all',
      sort: 'created',
      status: 'all',
      week: null,
    })
  })

  test('normalizes a shared week date to Sunday', () => {
    expect(
      readUrlState(new URL('https://example.test/?week=2027-01-06')).week,
    ).toBe('2027-01-03')
  })

  test('uses the current week when its Sunday is explicitly linked', () => {
    expect(
      readUrlState(new URL(`https://example.test/?week=${weekDays()[0]}`)).week,
    ).toBeNull()
  })

  test('restores the done-only filter from a shared URL', () => {
    expect(
      readUrlState(new URL('https://example.test/?status=done')).status,
    ).toBe('done')
  })
})
