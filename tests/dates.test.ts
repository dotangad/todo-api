import { describe, expect, test } from 'bun:test'
import {
  dateTimeLabel,
  parseWeekStart,
  shiftWeek,
  timeLabel,
} from '../src/client/dates'

const year = new Date().getFullYear()
const date = `${year}-10-12`

test('validates and normalizes a week to Sunday', () => {
  expect(parseWeekStart('2027-01-06')).toBe('2027-01-03')
  expect(parseWeekStart('2026-02-30')).toBeNull()
  expect(parseWeekStart('nonsense')).toBeNull()
})

test('navigates by local calendar weeks across year and DST boundaries', () => {
  expect(shiftWeek('2025-12-28', 1)).toBe('2026-01-04')
  expect(shiftWeek('2026-03-08', 1)).toBe('2026-03-15')
  expect(shiftWeek('2026-03-08', -1)).toBe('2026-03-01')
})

describe('date/time labels', () => {
  test('shows a placeholder without a date', () => {
    expect(dateTimeLabel('', '', 'en-US')).toBe('Set date')
  })

  test('supports date-only values and shows other years', () => {
    expect(dateTimeLabel(date, '', 'en-US')).toBe('Oct 12')
    expect(dateTimeLabel('2001-10-12', '', 'en-US')).toBe('Oct 12, 2001')
  })

  test('formats optional schedule time for cards', () => {
    expect(timeLabel('15:00:00', 'en-US')).toBe('3:00 PM')
    expect(timeLabel('23:59:45', 'en-US')).toBe('11:59:45 PM')
  })

  test('formats local wall-clock time without shifting the day or hour', () => {
    expect(dateTimeLabel(date, '00:00:00', 'en-US')).toBe('Oct 12, 12:00 AM')
    expect(dateTimeLabel(date, '14:30', 'en-US')).toBe('Oct 12, 2:30 PM')
    expect(dateTimeLabel(date, '23:59:45', 'en-US')).toBe('Oct 12, 11:59:45 PM')
  })
})
