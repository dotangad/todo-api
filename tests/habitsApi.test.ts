import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('habit API validates input, persists unique day logs, and cascades deletion without touching existing data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'habits-api-'))
  const path = join(directory, 'todos.sqlite')
  const run = (script: string) => {
    const result = Bun.spawnSync([process.execPath, '--eval', script], {
      cwd: process.cwd(),
      env: { ...process.env, TODO_DATABASE_PATH: path },
    })
    expect(result.stderr.toString()).toBe('')
    expect(result.exitCode).toBe(0)
    return JSON.parse(result.stdout.toString())
  }
  try {
    // Simulate an existing installation before habits were introduced.
    const db = new Database(path)
    db.exec(`create table todos (
      id text primary key, title text not null, description text,
      completed integer not null default 0, parent_id text references todos(id) on delete cascade,
      schedule_date text, schedule_time text, due_date text, due_time text,
      created_at text not null, updated_at text not null
    ); insert into todos (id, title, created_at, updated_at) values ('legacy', 'Existing todo', '2026-01-01', '2026-01-01');`)
    db.close()
    const created = run(`
      import { strict as assert } from 'node:assert';
      const { default: app } = await import('./src/index');
      const request = (path, method = 'GET', body) => app.request(path, {
        method, headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      for (const body of [null, [], {}, {title:''}, {title:'  '}, {title:123}])
        assert.equal((await request('/api/habits', 'POST', body)).status, 400);
      assert.equal((await app.request('/api/habits', {method:'POST', body:'{'})).status, 400);
      const response = await request('/api/habits', 'POST', {title:'  Read daily  '});
      assert.equal(response.status, 201);
      const habit = await response.json();
      assert.equal(habit.title, 'Read daily');
      assert.deepEqual(habit.logs, []);
      const url = '/api/habits/' + habit.id;
      for (const date of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'nope', '0000-01-01']) {
        assert.equal((await request(url + '/logs/' + date, 'PUT')).status, 400);
        assert.equal((await request(url + '/logs/' + date, 'DELETE')).status, 400);
      }
      for (const date of ['2024-02-29', '2026-11-01', '2026-11-01'])
        assert.equal((await request(url + '/logs/' + date, 'PUT')).status, 200);
      assert.deepEqual((await (await request(url)).json()).logs, ['2024-02-29', '2026-11-01']);
      assert.equal((await request(url, 'PATCH', {title:' '})).status, 400);
      const renamed = await (await request(url, 'PATCH', {title:'Read a book'})).json();
      assert.equal(renamed.title, 'Read a book');
      assert.equal(renamed.logs.length, 2);
      for (let i = 0; i < 2; i++) {
        const unlogged = await (await request(url + '/logs/2026-11-01', 'DELETE')).json();
        assert.deepEqual(unlogged.logs, ['2024-02-29']);
      }
      assert.equal((await request('/api/habits/missing', 'GET')).status, 404);
      assert.equal((await request('/api/habits/missing', 'PATCH', {title:'X'})).status, 404);
      assert.equal((await request('/api/habits/missing', 'DELETE')).status, 404);
      for (const method of ['PUT', 'DELETE'])
        assert.equal((await request('/api/habits/missing/logs/2026-01-01', method)).status, 404);
      const page = await request('/habits');
      assert.equal(page.status, 200);
      assert.match(await page.text(), /data-page="habits"/);
      assert.ok((await (await request('/')).text()).includes('href="/habits"'));
      assert.deepEqual(await (await request('/api/habits')).json(), [await (await request(url)).json()]);
      console.log(JSON.stringify(await (await request(url)).json()));
    `)
    expect(created.title).toBe('Read a book')
    expect(created.logs).toEqual(['2024-02-29'])
    // A second process verifies startup is idempotent and data survives reopening.
    const reopened = run(`
      import { strict as assert } from 'node:assert';
      const { default: app } = await import('./src/index');
      const { db } = await import('./src/server/database');
      const habits = await (await app.request('/api/habits')).json();
      assert.equal(habits.length, 1);
      assert.equal((await app.request('/api/habits/' + habits[0].id, {method:'DELETE'})).status, 204);
      assert.equal(db.query('select count(*) as n from habit_logs').get().n, 0);
      assert.equal((await (await app.request('/api/todos/legacy')).json()).title, 'Existing todo');
      assert.deepEqual(await (await app.request('/api/habits')).json(), []);
      console.log(JSON.stringify(habits[0]));
    `)
    expect(reopened).toEqual(created)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
