import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { authenticatedRequest, seedAuth } from './auth-fixture';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { UserEntity } from '../src/auth/auth.entities';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { WorkLogEntity } from '../src/work-logs/work-log.entity';
import type { TimerResponse } from '../src/timers/timers.service';
import type { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import type { HierarchyTodoResponse } from '../src/todos/dto/todo-hierarchy-response.dto';
import { resetDatabase } from './reset-database';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const MINUTE = 60_000;

describe('Kampagnen-Board: In Arbeit, set-aside and Geblockt (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let now: Date;
  const clock = {
    now: () => new Date(now),
    today: () => dayOf(new Date(now)),
  };
  const client = () => authenticatedRequest(server);
  const later = (milliseconds: number): void => {
    now = new Date(now.getTime() + milliseconds);
  };
  const ago = (milliseconds: number) =>
    new Date(now.getTime() - milliseconds).toISOString();

  const quest = async () =>
    (await client().post('/todos').send({ title: 'Kapitel 2' }).expect(201))
      .body as TodoResponseDto;
  const read = async (id: number) =>
    (await client().get(`/todos/${id}`).expect(200)).body as TodoResponseDto;
  const node = async (id: number) =>
    (
      (await client().get('/todos/hierarchy').expect(200))
        .body as HierarchyTodoResponse[]
    ).find((todo) => todo.id === id)!;
  const log = (id: number, startedAt: string, endedAt: string) =>
    client()
      .post('/work-logs')
      .send({ kind: 'todo', targetId: id, startedAt, endedAt })
      .expect(201);
  const setAside = async (id: number, blocked: boolean) =>
    (
      await client()
        .post(`/todos/${id}/set-aside`)
        .send({ blocked })
        .expect(200)
    ).body as TodoResponseDto;
  const block = (id: number, blocked: boolean) =>
    client().patch(`/todos/${id}`).send({ blocked }).expect(200);
  const startTimer = async (id: number) =>
    (
      (
        await client()
          .post('/timers')
          .send({ kind: 'todo', targetId: id })
          .expect(201)
      ).body as TimerResponse
    ).timer!;
  const timerAction = (id: string, action: 'pause' | 'resume' | 'stop') =>
    client().post(`/timers/${id}/${action}`).send({}).expect(201);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    server = app.getHttpServer() as Server;
  });
  beforeEach(async () => {
    await resetDatabase(db);
    await seedAuth(app);
    now = new Date();
  });
  afterAll(async () => {
    if (db?.isInitialized) await resetDatabase(db);
    await app?.close();
  });

  it('takes several quests into In Arbeit by hand, until each is set aside', async () => {
    const first = await quest();
    const second = await quest();
    await block(second.id, true);
    for (const { id } of [first, second])
      await client().post(`/todos/${id}/start-work`).send({}).expect(200);
    expect(await node(first.id)).toMatchObject({ inProgress: true });
    expect(await node(second.id)).toMatchObject({
      inProgress: true,
      blocked: false,
    });

    later(MINUTE);
    await setAside(first.id, false);
    expect(await node(first.id)).toMatchObject({ inProgress: false });
    expect(await node(second.id)).toMatchObject({ inProgress: true });

    later(MINUTE);
    await client().post(`/todos/${first.id}/start-work`).send({}).expect(200);
    expect(await node(first.id)).toMatchObject({ inProgress: true });

    await client().patch(`/todos/${first.id}`).send({ completed: true });
    await client().post(`/todos/${first.id}/start-work`).send({}).expect(409);
    await client().post('/todos/424242/start-work').send({}).expect(404);
  });

  it('is in progress after logged work, not after a set-aside, and again after new work', async () => {
    const { id, blocked, setAsideAt } = await quest();
    expect({ blocked, setAsideAt }).toEqual({
      blocked: false,
      setAsideAt: null,
    });
    expect(await node(id)).toMatchObject({ inProgress: false });

    await log(id, ago(30 * MINUTE), ago(10 * MINUTE));
    expect(await node(id)).toMatchObject({ inProgress: true });

    later(MINUTE);
    expect(await setAside(id, false)).toMatchObject({
      blocked: false,
      setAsideAt: now.toISOString(),
    });
    expect(await node(id)).toMatchObject({
      inProgress: false,
      setAsideAt: now.toISOString(),
    });

    // Work entered afterwards that ended before the set-aside does not count.
    later(MINUTE);
    await log(id, ago(40 * MINUTE), ago(35 * MINUTE));
    expect(await node(id)).toMatchObject({ inProgress: false });
    await log(id, ago(5 * MINUTE), ago(0));
    expect(await node(id)).toMatchObject({ inProgress: true });
  });

  it('ends the stopwatch on a set-aside and keeps its work logged', async () => {
    const { id } = await quest();
    const timer = await startTimer(id);
    // Running before a single log exists.
    expect(await node(id)).toMatchObject({ inProgress: true });

    later(10 * MINUTE);
    expect(await setAside(id, true)).toMatchObject({ blocked: true });
    expect(
      (
        (await client().get('/timers/current').expect(200))
          .body as TimerResponse
      ).timer,
    ).toBeNull();
    const logs = await db.getRepository(WorkLogEntity).findBy({ todoId: id });
    expect(logs).toEqual([
      expect.objectContaining({ endedAt: now, source: 'timer' }),
    ]);
    expect(await node(id)).toMatchObject({ inProgress: false, blocked: true });

    // The stopped stopwatch is no longer the one to resume.
    await client().post(`/timers/${timer.id}/resume`).send({}).expect(409);
  });

  it('lifts Geblockt when a stopwatch starts or resumes and when the quest is completed', async () => {
    const { id } = await quest();
    await block(id, true);
    expect(await read(id)).toMatchObject({ blocked: true });

    const timer = await startTimer(id);
    expect(await read(id)).toMatchObject({ blocked: false });

    later(5 * MINUTE);
    await timerAction(timer.id, 'pause');
    later(5 * MINUTE);
    await block(id, true);
    await timerAction(timer.id, 'resume');
    expect(await read(id)).toMatchObject({ blocked: false });

    later(5 * MINUTE);
    await timerAction(timer.id, 'stop');
    await block(id, true);
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    expect(await node(id)).toMatchObject({
      completed: true,
      blocked: false,
      inProgress: false,
    });

    // A completed quest can neither be blocked nor set aside.
    await client().patch(`/todos/${id}`).send({ blocked: true }).expect(409);
    await client()
      .post(`/todos/${id}/set-aside`)
      .send({ blocked: false })
      .expect(409);
  });

  it('answers 404 for a foreign todo and 400 for a malformed body', async () => {
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
    const foreign = await db.getRepository(TodoEntity).save({
      userId: OTHER_USER,
      title: 'Fremd',
      completed: false,
    });
    await client()
      .post(`/todos/${foreign.id}/set-aside`)
      .send({ blocked: true })
      .expect(404);
    await client()
      .patch(`/todos/${foreign.id}`)
      .send({ blocked: true })
      .expect(404);
    expect(
      await db.getRepository(TodoEntity).findOneByOrFail({ id: foreign.id }),
    ).toMatchObject({ blocked: false, setAsideAt: null });

    const { id } = await quest();
    for (const body of [
      {},
      { blocked: 'yes' },
      { blocked: null },
      { blocked: true, setAsideAt: now.toISOString() },
    ])
      await client().post(`/todos/${id}/set-aside`).send(body).expect(400);
    await client().patch(`/todos/${id}`).send({ blocked: null }).expect(400);
    await client().patch(`/todos/${id}`).send({ blocked: 1 }).expect(400);
    expect(await read(id)).toMatchObject({ blocked: false, setAsideAt: null });
  });
});
