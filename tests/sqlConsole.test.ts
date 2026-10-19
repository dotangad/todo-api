import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createSqlConsole, createSqlRoutes } from '../src/server/sqlConsole'

let db: Database
let service: ReturnType<typeof createSqlConsole>

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE todos (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
      parent_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      schedule_date TEXT, schedule_time TEXT, due_date TEXT, due_time TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE todo_tags (
      todo_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY(todo_id,tag_id)
    );
    CREATE TABLE focus_state (selected_ids TEXT, completed_todos TEXT);
    CREATE TABLE focus_events (kind TEXT);
    CREATE TABLE work_sessions (completed_todos TEXT);
    INSERT INTO todos(id,title,created_at,updated_at) VALUES ('root','Root','created','updated');
    INSERT INTO todos(id,title,parent_id,created_at,updated_at) VALUES ('child','Child','root','created','updated');
    INSERT INTO todos(id,title,parent_id,created_at,updated_at) VALUES ('grandchild','Grandchild','child','created','updated');
    INSERT INTO tags VALUES ('tag','work');
    INSERT INTO todo_tags VALUES ('root','tag'),('child','tag'),('grandchild','tag');
    INSERT INTO focus_state VALUES ('["root"]','[]');
    INSERT INTO focus_events VALUES ('start');
    INSERT INTO work_sessions VALUES ('[]');
  `)
  service = createSqlConsole(db)
})
afterEach(() => db.close())

const dump = (database: Database) =>
  ['todos', 'tags', 'todo_tags'].map((table) =>
    database
      .query(
        `SELECT * FROM ${table} ORDER BY ${table === 'todo_tags' ? 'todo_id, tag_id' : 'id'}`,
      )
      .all(),
  )

describe('console SQL service', () => {
  test('selects raw rows and binds JSON scalars', () => {
    expect(
      service.execute('SELECT id, completed FROM todos WHERE id = ?', ['root']),
    ).toEqual({
      rows: [{ id: 'root', completed: 0 }],
      changes: 0,
      undoToken: null,
    })
    expect(
      service.execute('SELECT ? AS flag, ? AS empty', [true, null]).rows,
    ).toEqual([{ flag: 1, empty: null }])
    expect(
      service.execute(
        'SELECT tags.name FROM todos JOIN todo_tags ON todo_tags.todo_id=todos.id JOIN tags ON tags.id=todo_tags.tag_id',
      ).rows,
    ).toHaveLength(3)
  })

  test('bulk writes, ordinary CTEs, RETURNING, and affected counts', () => {
    const result = service.execute(
      'WITH selected AS (SELECT id FROM todos WHERE completed=0) UPDATE todos SET completed=1 WHERE id IN (SELECT id FROM selected) RETURNING id, completed',
    )
    expect(result.rows).toHaveLength(3)
    expect(result.changes).toBe(3)
    expect(result.undoToken).toBeString()
    expect(service.execute('UPDATE todos SET completed=0').changes).toBe(3)
    expect(
      service.execute(
        "INSERT INTO todos(id,title,created_at,updated_at) VALUES ('new','New','c','u') RETURNING id",
      ).rows,
    ).toEqual([{ id: 'new' }])
  })

  test('reads, no-ops, and failed queries keep the previous undo point', () => {
    const before = dump(db)
    const token = service.execute('UPDATE todos SET completed=1').undoToken
    expect(service.execute('SELECT * FROM todos').undoToken).toBeNull()
    expect(
      service.execute('UPDATE todos SET completed=completed').undoToken,
    ).toBeNull()
    expect(service.execute('DELETE FROM todos WHERE 0').undoToken).toBeNull()
    expect(() => service.execute('UPDATE todos SET completed=3')).toThrow()
    expect(() => service.execute('UPDATE todos SET nonexistent=1')).toThrow()
    service.undo(token)
    expect(dump(db)).toEqual(before)
    expect(() => service.undo(token)).toThrow('Nothing to undo')
  })

  test('new writes replace undo, and restore exact prior values', () => {
    const first = service.execute(
      "UPDATE todos SET title='First', updated_at='first' WHERE id='root'",
    )
    const before = dump(db)
    const second = service.execute(
      "UPDATE todos SET title='Second', updated_at='second'",
    )
    expect(() => service.undo(first.undoToken)).toThrow('stale')
    service.undo(second.undoToken)
    expect(dump(db)).toEqual(before)
  })

  test('undo restores cascading descendants and tag associations without touching focus', () => {
    const before = dump(db)
    const token = service.execute("DELETE FROM todos WHERE id='root'").undoToken
    expect(db.query('SELECT * FROM todos').all()).toEqual([])
    expect(db.query('SELECT * FROM todo_tags').all()).toEqual([])
    db.exec("INSERT INTO focus_events VALUES ('stop')")
    service.undo(token)
    expect(dump(db)).toEqual(before)
    expect(db.query('SELECT * FROM focus_state').all()).toEqual([
      { selected_ids: '["root"]', completed_todos: '[]' },
    ])
    expect(db.query('SELECT * FROM focus_events').all()).toEqual([
      { kind: 'start' },
      { kind: 'stop' },
    ])
    expect(db.query('SELECT * FROM work_sessions').all()).toEqual([
      { completed_todos: '[]' },
    ])
    expect(db.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([])
  })

  test('undo inserted todos and reparenting without cascade damage', () => {
    const before = dump(db)
    const insert = service.execute(
      "INSERT INTO todos(id,title,created_at,updated_at) VALUES ('new','New','c','u')",
    )
    service.undo(insert.undoToken)
    expect(dump(db)).toEqual(before)
    const move = service.execute(
      "UPDATE todos SET parent_id=NULL WHERE id='child'",
    )
    service.undo(move.undoToken)
    expect(dump(db)).toEqual(before)
  })

  test('refuses to overwrite later REST or focus completion edits', () => {
    const result = service.execute("UPDATE todos SET title='Changed'")
    db.exec("UPDATE todos SET completed=1 WHERE id='child'")
    const current = dump(db)
    expect(() => service.undo(result.undoToken)).toThrow('changed since')
    expect(dump(db)).toEqual(current)
    expect(db.inTransaction).toBe(false)
  })

  test('undo record is scoped to the service lifetime', () => {
    const result = service.execute("UPDATE todos SET title='Changed'")
    expect(() => createSqlConsole(db).undo(result.undoToken)).toThrow(
      'Nothing to undo',
    )
  })

  test('rejects parent cycles and invalid UI field types atomically', () => {
    const before = dump(db)
    for (const query of [
      "UPDATE todos SET parent_id='grandchild' WHERE id='root'",
      'UPDATE todos SET parent_id=id',
      "UPDATE todos SET id=NULL WHERE id='grandchild'",
      "UPDATE todos SET title=x'1234'",
    ])
      expect(() => service.execute(query)).toThrow()
    expect(dump(db)).toEqual(before)
  })

  test('SQL-aware parsing handles quoted semicolons and comments but rejects scripts', () => {
    expect(
      service.execute("/* hello */ SELECT 'a;b' AS value; -- end").rows,
    ).toEqual([{ value: 'a;b' }])
    expect(() =>
      service.execute("UPDATE todos SET title='bad'; DELETE FROM todos"),
    ).toThrow()
    expect(db.query("SELECT title FROM todos WHERE id='root'").get()).toEqual({
      title: 'Root',
    })
  })

  test('fails closed on forbidden statements, objects, functions, and recursion', () => {
    const before = dump(db)
    for (const query of [
      'DROP TABLE todos',
      'BEGIN',
      'COMMIT',
      'PRAGMA foreign_keys=OFF',
      "ATTACH DATABASE ':memory:' AS other",
      'VACUUM',
      'SELECT * FROM focus_state',
      'SELECT * FROM main.sqlite_schema',
      'SELECT * FROM temp.todos',
      "SELECT * FROM pragma_table_info('todos')",
      "SELECT * FROM json_each('[1]')",
      "SELECT 1 WHERE 1 IN json_each('[1]')",
      "SELECT load_extension('/tmp/evil')",
      "SELECT writefile('/tmp/evil','x')",
      'SELECT randomblob(1000000000)',
      'DELETE FROM todo_tags',
      'WITH x AS (SELECT 1) DELETE FROM tags',
      'SELECT * FROM todos; PRAGMA foreign_keys=OFF',
      'WITH RECURSIVE x(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM x) SELECT * FROM x',
      'WITH x(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM x) SELECT * FROM x',
      'WITH todos AS (SELECT 1) SELECT * FROM todos',
      'SELECT * FROM focus_state WHERE EXISTS (WITH focus_state AS (SELECT 1) SELECT 1)',
      'UPDATE OR ROLLBACK todos SET completed=3',
    ])
      expect(() => service.execute(query), query).toThrow()
    expect(dump(db)).toEqual(before)
  })

  test('validates parameters and bounds query/results before committing', () => {
    for (const [query, params] of [
      ['', []],
      [' '.repeat(33000), []],
      ['SELECT ?', []],
      ['SELECT 1', [1]],
      ['SELECT :name', ['a']],
      ['SELECT ?', [{}]],
      ['SELECT ?', [Infinity]],
    ] as const)
      expect(() => service.execute(query, params)).toThrow()
    // Row overflow must undo the write as well as reject the result.
    const before = dump(db)
    expect(() =>
      service.execute(`INSERT INTO todos(id,title,created_at,updated_at)
      SELECT a.value || '-' || b.value, 'New', 'c', 'u'
      FROM (WITH x(value) AS (VALUES(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11)) SELECT * FROM x) a
      CROSS JOIN (WITH y(value) AS (VALUES(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11)) SELECT * FROM y) b
      RETURNING replace(hex(title), '4E', '${'z'.repeat(17000)}')`),
    ).toThrow('2 MB')
    expect(dump(db)).toEqual(before)
    expect(() =>
      service.execute(`SELECT a.id FROM todos a CROSS JOIN todos b CROSS JOIN todos c
      CROSS JOIN todos d CROSS JOIN todos e CROSS JOIN todos f CROSS JOIN todos g
      CROSS JOIN todos h CROSS JOIN todos i`),
    ).toThrow('row limit')
  })
})

describe('SQL HTTP boundary', () => {
  function request(
    app: ReturnType<typeof createSqlRoutes>,
    body: unknown,
    headers: Record<string, string> = {},
    path = '/',
  ) {
    return app.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  test('executes and undoes with JSON responses', async () => {
    const app = createSqlRoutes(db)
    const response = await request(app, {
      query: 'UPDATE todos SET completed=1',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body.changes).toBe(3)
    expect(
      (await request(app, { undoToken: 'wrong' }, {}, '/undo')).status,
    ).toBe(409)
    expect(
      (await request(app, { undoToken: body.undoToken }, {}, '/undo')).status,
    ).toBe(200)
    expect(
      (await request(app, { undoToken: body.undoToken }, {}, '/undo')).status,
    ).toBe(409)
  })

  test('rejects cross-origin, missing origins, non-JSON, and oversized bodies', async () => {
    const app = createSqlRoutes(db)
    for (const headers of [
      { origin: 'https://evil.example' },
      { origin: '' },
      { 'sec-fetch-site': 'cross-site' },
    ])
      expect((await request(app, { query: 'SELECT 1' }, headers)).status).toBe(
        403,
      )
    expect(
      (await request(app, {}, { 'content-type': 'text/plain' })).status,
    ).toBe(415)
    expect((await request(app, null)).status).toBe(400)
    expect((await request(app, { query: 'x'.repeat(66000) })).status).toBe(413)
  })

  test('only configured origins can use the Tailscale proxy', async () => {
    const app = createSqlRoutes(db, 'https://todos.tailnet.example:3011')
    expect(
      (
        await request(
          app,
          { query: 'SELECT 1' },
          { origin: 'https://todos.tailnet.example:3011' },
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await request(
          createSqlRoutes(db),
          { query: 'SELECT 1' },
          { origin: 'https://todos.tailnet.example:3011' },
        )
      ).status,
    ).toBe(403)
  })
})
