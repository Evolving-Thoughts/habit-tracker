import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { UserEntity } from '../src/auth/auth.entities';
import { TimerEntity } from '../src/timers/timer.entity';
import { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import { TodoProgress } from '../src/todos/todo-hierarchy';
import { TodoHierarchy1792620000000 } from '../src/migrations/1792620000000-TodoHierarchy';
type Node = TodoResponseDto & { progress: TodoProgress };
type Preview = {
  confirmationToken: string;
  todos: { id: number; title: string }[];
  timers: { id: string; state: string }[];
};
describe('Todo hierarchy T2/T3 PostgreSQL API', () => {
  let app: INestApplication, server: Server, db: DataSource;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    db = app.get(DataSource);
    server = app.getHttpServer() as Server;
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE push_deliveries, push_subscriptions, timers, todos RESTART IDENTITY',
    );
  });
  afterAll(async () => {
    await app.close();
  });
  const create = async (
    title: string,
    parentId: number | null = null,
    duration: number | null = null,
  ) => {
    const res = await request(server)
      .post('/todos')
      .send({ title, parentId, plannedDurationMinutes: duration })
      .expect(201);
    return res.body as TodoResponseDto;
  };
  const patch = async (id: number, body: object) =>
    request(server).patch(`/todos/${id}`).send(body).expect(200);
  const tree = async () =>
    (await request(server).get('/todos/hierarchy').expect(200)).body as Node[];
  const preview = async (id: number) =>
    (await request(server).get(`/todos/${id}/deletion-preview`).expect(200))
      .body as Preview;
  it('persists hierarchy, independent completion and automatic weighting', async () => {
    const root = await create('Root', null, 60),
      a = await create('A', root.id, 30),
      b = await create('B', root.id, 90);
    await patch(root.id, { completed: true });
    await patch(a.id, { completed: true });
    expect(
      (await tree()).find((t) => t.id === root.id)?.progress,
    ).toMatchObject({
      mode: 'duration',
      completed: 90,
      total: 180,
      percentage: 50,
    });
    await patch(b.id, { plannedDurationMinutes: null });
    expect(
      (await tree()).find((t) => t.id === root.id)?.progress,
    ).toMatchObject({
      mode: 'count',
      completed: 2,
      total: 3,
      knownDurationMinutes: 90,
    });
    expect(
      await db.getRepository(TodoEntity).findOneBy({ id: b.id }),
    ).toMatchObject({ parentId: root.id });
    await patch(a.id, { completed: false });
    expect((await tree()).find((t) => t.id === root.id)).toMatchObject({
      completed: false,
      completedAt: null,
    });
  });
  it('preserves parent schedule, fixation, duration and paused timer when adding a child', async () => {
    const root = await create('Root', null, 60);
    await patch(root.id, {
      scheduledAt: '2026-01-01T10:00:00Z',
      isFixed: true,
    });
    const start = await request(server)
      .post('/timers')
      .send({ kind: 'todo', targetId: root.id })
      .expect(201);
    const timer = (start.body as { timer: { id: string } }).timer;
    await request(server)
      .post(`/timers/${timer.id}/pause`)
      .send({})
      .expect(201);
    const before = await db
      .getRepository(TimerEntity)
      .findOneByOrFail({ id: timer.id });
    await patch(root.id, { completed: true });
    await create('Child', root.id);
    const after = await db
      .getRepository(TimerEntity)
      .findOneByOrFail({ id: timer.id });
    expect(after).toEqual(before);
    expect((await tree()).find((t) => t.id === root.id)).toMatchObject({
      completed: false,
      completedAt: null,
      isFixed: true,
      plannedDurationMinutes: 60,
      scheduledAt: '2026-01-01T10:00:00.000Z',
    });
  });
  it('moves the entire subtree and reopens target ancestors, without changing old parent properties', async () => {
    const old = await create('Old'),
      root = await create('Moving', old.id),
      child = await create('Open', root.id),
      target = await create('Target');
    await patch(root.id, { completed: true });
    await patch(target.id, { completed: true });
    await patch(old.id, { completed: true });
    await patch(root.id, { parentId: target.id });
    const rows = await tree();
    expect(rows.find((t) => t.id === target.id)?.completed).toBe(false);
    expect(rows.find((t) => t.id === old.id)?.completed).toBe(true);
    expect(rows.find((t) => t.id === child.id)?.parentId).toBe(root.id);
    await patch(root.id, { parentId: null });
    expect((await tree()).find((t) => t.id === root.id)?.parentId).toBeNull();
  });
  it('rejects cycles, invalid DTO values and foreign/deleted parents without leaking data', async () => {
    const root = await create('Root'),
      child = await create('Child', root.id);
    await request(server)
      .patch(`/todos/${root.id}`)
      .send({ parentId: child.id })
      .expect(400);
    for (const parentId of [root.id, -1, 1.5, '1'])
      await request(server)
        .patch(`/todos/${root.id}`)
        .send({ parentId })
        .expect(400);
    const other = '22222222-2222-4222-8222-222222222222';
    await db.getRepository(UserEntity).save({
      id: other,
      email: 'other@example.test',
      passwordHash: 'not-a-real-password',
      verifiedAt: new Date(),
    });
    const foreign = await db
      .getRepository(TodoEntity)
      .save({ userId: other, title: 'Private' });
    await request(server)
      .post('/todos')
      .send({ title: 'Invalid', parentId: foreign.id })
      .expect(400);
    await request(server).get(`/todos/${foreign.id}`).expect(404);
    await request(server)
      .get(`/todos/${foreign.id}/deletion-preview`)
      .expect(404);
    expect((await tree()).some((t) => t.id === foreign.id)).toBe(false);
    const deleted = await create('Deleted');
    await request(server).delete(`/todos/${deleted.id}`).expect(204);
    await request(server)
      .post('/todos')
      .send({ title: 'Invalid', parentId: deleted.id })
      .expect(400);
  });
  it('serializes concurrent inverse moves so no cycle can be committed', async () => {
    const a = await create('A'),
      b = await create('B');
    const responses = await Promise.all([
      request(server).patch(`/todos/${a.id}`).send({ parentId: b.id }),
      request(server).patch(`/todos/${b.id}`).send({ parentId: a.id }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await tree()).toHaveLength(2);
  });
  it('returns a read-only deletion preview, rejects stale confirmation, deletes paused timers and preserves history', async () => {
    const root = await create('Root', null, 60),
      child = await create('Child', root.id, 30);
    const started = await request(server)
      .post('/timers')
      .send({ kind: 'todo', targetId: child.id })
      .expect(201);
    const timer = (started.body as { timer: { id: string } }).timer;
    await request(server)
      .post(`/timers/${timer.id}/pause`)
      .send({})
      .expect(201);
    await patch(child.id, { completed: true });
    const completion = (await tree()).find(
      (t) => t.id === child.id,
    )?.completedAt;
    const first = await preview(root.id);
    expect(first.todos).toHaveLength(2);
    expect(first.timers).toMatchObject([{ id: timer.id, state: 'paused' }]);
    expect(await tree()).toHaveLength(2);
    await request(server).delete(`/todos/${root.id}`).expect(409);
    await create('Added after preview', root.id);
    await request(server)
      .delete(`/todos/${root.id}`)
      .send({ confirmationToken: first.confirmationToken })
      .expect(409);
    expect(await tree()).toHaveLength(3);
    const current = await preview(root.id);
    await request(server)
      .delete(`/todos/${root.id}`)
      .send({ confirmationToken: current.confirmationToken })
      .expect(204);
    expect(await tree()).toHaveLength(0);
    expect(await db.getRepository(TimerEntity).countBy({ id: timer.id })).toBe(
      0,
    );
    const retained = await db
      .getRepository(TodoEntity)
      .findOne({ where: { id: child.id }, withDeleted: true });
    expect(retained?.deletedAt).toBeInstanceOf(Date);
    expect(retained?.completedAt?.toISOString()).toBe(completion);
    const date = completion!.slice(0, 10);
    const history = await request(server)
      .get(`/history?date=${date}&view=day`)
      .expect(200);
    expect(JSON.stringify(history.body)).toContain('Child');
    await request(server)
      .delete(`/todos/${root.id}`)
      .send({ confirmationToken: current.confirmationToken })
      .expect(404);
  });
  it('detects timer state changes after confirmation preview', async () => {
    const root = await create('Root', null, 30);
    const started = await request(server)
      .post('/timers')
      .send({ kind: 'todo', targetId: root.id })
      .expect(201);
    const first = await preview(root.id);
    const timer = (started.body as { timer: { id: string } }).timer;
    await request(server)
      .post(`/timers/${timer.id}/pause`)
      .send({})
      .expect(201);
    await request(server)
      .delete(`/todos/${root.id}`)
      .send({ confirmationToken: first.confirmationToken })
      .expect(409);
    expect(await tree()).toHaveLength(1);
  });
  it('rolls timer deletion back if soft-deletion fails', async () => {
    const root = await create('Root', null, 30),
      child = await create('Child', root.id);
    await request(server)
      .post('/timers')
      .send({ kind: 'todo', targetId: root.id })
      .expect(201);
    const snap = await preview(root.id);
    await db.query(
      `CREATE FUNCTION test_abort_delete() RETURNS trigger AS $$ BEGIN IF NEW."deletedAt" IS NOT NULL THEN RAISE EXCEPTION 'injected delete failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    await db.query(
      'CREATE TRIGGER test_abort_delete BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION test_abort_delete()',
    );
    try {
      await request(server)
        .delete(`/todos/${root.id}`)
        .send({ confirmationToken: snap.confirmationToken })
        .expect(500);
      expect(await tree()).toHaveLength(2);
      expect(
        await db.getRepository(TimerEntity).countBy({ todoId: root.id }),
      ).toBe(1);
      expect(
        await db.getRepository(TodoEntity).findOneBy({ id: child.id }),
      ).not.toBeNull();
    } finally {
      await db.query('DROP TRIGGER test_abort_delete ON todos');
      await db.query('DROP FUNCTION test_abort_delete()');
    }
  });
  it('loads and soft-deletes a 2,000-level hierarchy without recursive processing or unbounded SQL parameters', async () => {
    await db.query(
      `INSERT INTO todos (id,"userId",title,"parentId","plannedDurationMinutes") SELECT i,$1,'Level '||i,CASE WHEN i=1 THEN NULL ELSE i-1 END,1 FROM generate_series(1,2000) i`,
      [TEST_USER],
    );
    const started = performance.now();
    const nodes = await tree();
    expect(nodes).toHaveLength(2000);
    expect(nodes.find((t) => t.id === 1)?.progress).toMatchObject({
      total: 2000,
      todoCount: 2000,
    });
    const snapshot = await preview(1);
    expect(snapshot.todos).toHaveLength(2000);
    await request(server)
      .delete('/todos/1')
      .send({ confirmationToken: snapshot.confirmationToken })
      .expect(204);
    expect(await tree()).toHaveLength(0);
    console.log(
      `Hierarchy load/preview/delete, 2,000 levels: ${Math.round(performance.now() - started)} ms`,
    );
  });
  it('migrates an existing table additively and repeatably', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.query('CREATE SCHEMA hierarchy_migration_test');
      await runner.query('SET search_path TO hierarchy_migration_test');
      await runner.query(
        'CREATE TABLE todos (id serial PRIMARY KEY,title text NOT NULL)',
      );
      await runner.query("INSERT INTO todos(title) VALUES ('Existing')");
      const migration = new TodoHierarchy1792620000000();
      await migration.up(runner);
      await migration.up(runner);
      const rows = (await runner.query(
        'SELECT title,"parentId" FROM todos',
      )) as { title: string; parentId: number | null }[];
      expect(rows).toEqual([{ title: 'Existing', parentId: null }]);
    } finally {
      await runner.query('SET search_path TO public');
      await runner.query(
        'DROP SCHEMA IF EXISTS hierarchy_migration_test CASCADE',
      );
      await runner.release();
    }
  });
});
