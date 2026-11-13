import { Hono } from 'hono'
import { type Habit, isHabitDate } from '../habitTypes'
import { db } from './database'

db.exec(`create table if not exists habits (
  id text primary key,
  title text not null check(length(trim(title)) > 0),
  created_at text not null
);
create table if not exists habit_logs (
  habit_id text not null references habits(id) on delete cascade,
  date text not null,
  primary key (habit_id, date)
);`)

const columns = 'id, title, created_at as createdAt'

export function listHabits(): Habit[] {
  const habits = db
    .query(`select ${columns} from habits order by created_at, id`)
    .all() as Omit<Habit, 'logs'>[]
  const logs = db
    .query('select habit_id, date from habit_logs order by date')
    .all() as { habit_id: string; date: string }[]
  const byHabit = new Map<string, string[]>()
  for (const log of logs) {
    const dates = byHabit.get(log.habit_id) ?? []
    dates.push(log.date)
    byHabit.set(log.habit_id, dates)
  }
  return habits.map((habit) => ({
    ...habit,
    logs: byHabit.get(habit.id) ?? [],
  }))
}

function getHabit(id: string): Habit | null {
  const habit = db
    .query(`select ${columns} from habits where id = ?`)
    .get(id) as Omit<Habit, 'logs'> | null
  if (!habit) return null
  const logs = db
    .query('select date from habit_logs where habit_id = ? order by date')
    .all(id) as { date: string }[]
  return { ...habit, logs: logs.map((log) => log.date) }
}

function parseTitle(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new Error('JSON object is required.')
  const title = (body as Record<string, unknown>).title
  if (typeof title !== 'string' || !title.trim())
    throw new Error('A habit title is required.')
  return title.trim()
}

export function createHabitRoutes() {
  const routes = new Hono()
  const invalid = (message: string) => ({ error: { message } })
  routes.get('/', (c) => c.json(listHabits()))
  routes.get('/:id', (c) => {
    const habit = getHabit(c.req.param('id'))
    return habit ? c.json(habit) : c.json(invalid('Habit not found.'), 404)
  })
  routes.post('/', async (c) => {
    let title: string
    try {
      title = parseTitle(await c.req.json().catch(() => null))
    } catch (error) {
      return c.json(invalid((error as Error).message), 400)
    }
    const id = crypto.randomUUID()
    db.query('insert into habits (id, title, created_at) values (?, ?, ?)').run(
      id,
      title,
      new Date().toISOString(),
    )
    return c.json(getHabit(id), 201)
  })
  routes.patch('/:id', async (c) => {
    const body = await c.req.json().catch(() => null)
    const id = c.req.param('id')
    if (!getHabit(id)) return c.json(invalid('Habit not found.'), 404)
    let title: string
    try {
      title = parseTitle(body)
    } catch (error) {
      return c.json(invalid((error as Error).message), 400)
    }
    db.query('update habits set title = ? where id = ?').run(title, id)
    return c.json(getHabit(id))
  })
  routes.delete('/:id', (c) =>
    db.query('delete from habits where id = ?').run(c.req.param('id')).changes
      ? c.body(null, 204)
      : c.json(invalid('Habit not found.'), 404),
  )
  // Explicit set/unset operations are idempotent, including retried requests.
  routes.on(['PUT', 'DELETE'], '/:id/logs/:date', (c) => {
    const { id, date } = c.req.param()
    if (!isHabitDate(date))
      return c.json(invalid('date must be a valid YYYY-MM-DD date.'), 400)
    if (!getHabit(id)) return c.json(invalid('Habit not found.'), 404)
    if (c.req.method === 'PUT')
      db.query(
        'insert into habit_logs (habit_id, date) values (?, ?) on conflict do nothing',
      ).run(id, date)
    else
      db.query('delete from habit_logs where habit_id = ? and date = ?').run(
        id,
        date,
      )
    return c.json(getHabit(id))
  })
  return routes
}
