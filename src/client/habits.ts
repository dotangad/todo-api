import { signal } from '@preact/signals'
import { type Habit, isHabitDate } from '../habitTypes'
import { api } from './actions'

export const habits = signal<Habit[]>([])
export const habitSaving = signal(false)
export const habitError = signal('')

// Calendar arithmetic in UTC avoids local DST shifts; month selection uses local today.
export function monthDays(month: string) {
  if (!isHabitDate(`${month}-01`)) return []
  const date = new Date(`${month}-01T12:00:00Z`)
  const days: string[] = []
  while (date.toISOString().slice(0, 7) === month) {
    days.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return days
}

export function shiftMonth(month: string, offset: number) {
  if (!isHabitDate(`${month}-01`)) return month
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  const next = date.toISOString().slice(0, 7)
  return isHabitDate(`${next}-01`) ? next : month
}

async function mutate(
  path: string,
  method: string,
  title?: string,
  deletedId?: string,
) {
  if (habitSaving.value) return false
  habitSaving.value = true
  habitError.value = ''
  try {
    const habit = await api<Habit>(path, {
      method,
      body: title === undefined ? undefined : JSON.stringify({ title }),
    })
    if (deletedId)
      habits.value = habits.value.filter((item) => item.id !== deletedId)
    else if (habits.value.some((item) => item.id === habit.id))
      habits.value = habits.value.map((item) =>
        item.id === habit.id ? habit : item,
      )
    else habits.value = [...habits.value, habit]
    return true
  } catch (error) {
    habitError.value =
      error instanceof Error ? error.message : 'Could not save habit.'
    return false
  } finally {
    habitSaving.value = false
  }
}

export const createHabit = (title: string) =>
  mutate('/api/habits', 'POST', title)
export const renameHabit = (id: string, title: string) =>
  mutate(`/api/habits/${id}`, 'PATCH', title)
export const deleteHabit = (id: string) =>
  mutate(`/api/habits/${id}`, 'DELETE', undefined, id)
export const setHabitCompletion = (
  id: string,
  date: string,
  completed: boolean,
) => mutate(`/api/habits/${id}/logs/${date}`, completed ? 'PUT' : 'DELETE')
