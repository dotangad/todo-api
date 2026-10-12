// Use local calendar dates, not UTC (which can be a different day).
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function weekDays(today = new Date()) {
  // Use local noon so week boundaries remain stable across DST transitions.
  const sunday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  )
  sunday.setDate(sunday.getDate() - sunday.getDay())
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(sunday)
    date.setDate(sunday.getDate() + offset)
    return dateKey(date)
  })
}

// Format a wall-clock value without timezone conversion (including DST gaps).
export function timeLabel(time: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    ...(Number(time.split(':')[2] ?? 0) ? { second: '2-digit' as const } : {}),
  }).format(new Date(`1970-01-01T${time}Z`))
}

export function dateTimeLabel(date: string, time = '', locale?: string) {
  if (!date) return 'Set date'
  const value = new Date(`${date}T${time || '12:00:00'}Z`)
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(Number(date.slice(0, 4)) !== new Date().getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  }).format(value)
  if (!time) return day
  return `${day}, ${timeLabel(time, locale)}`
}

export function dayLabel(day: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${day}T12:00:00`))
}
