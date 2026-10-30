import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { WorkLogEntity } from '../src/work-logs/work-log.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '44444444-4444-4444-8444-444444444444';
type Log = { id: number; title: string; minutes: number; source: string };
type Day = { totalMinutes: number; logs: Log[] };
type Timer = { timer: { id: string } };

describe('Work logs (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  let now: Date;
  const advance = (minutes: number): void => {
    now = new Date(now.getTime() + minutes * 60_000);
  };
  const iso = (minutesAgo: number): string =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const day = async (): Promise<Day> =>
    (
      await request(server)
        .get(`/work-logs?date=${dayOf(now)}`)
        .expect(200)
    ).body as Day;
  const todo = async (): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({ title: 'Schreiben', plannedDurationMinutes: 60 })
          .expect(201)
      ).body as { id: number }
    ).id;
  const start = async (id: number): Promise<string> =>
    (
      (
        await request(server)
          .post('/timers')
          .send({ kind: 'todo', targetId: id })
          .expect(201)
      ).body as Timer
    ).timer.id;
  const add = (id: number, from: number, to: number) =>
    request(server)
      .post('/work-logs')
      .send({
        kind: 'todo',
        targetId: id,
        startedAt: iso(from),
        endedAt: iso(to),
      });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({
        now: () => now,
        today: () => dayOf(now),
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'work@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(async () => {
    now = new Date('2026-10-30T09:00:00.000Z');
    await db.query(
      'TRUNCATE work_logs, push_deliveries, timers, todos CASCADE',
    );
  });
  afterAll(() => app.close());

  it('logs each running stretch of a timer, not the pauses', async () => {
    const id = await start(await todo());
    advance(10);
    await request(server).post(`/timers/${id}/pause`).send({}).expect(201);
    advance(30);
    await request(server).post(`/timers/${id}/resume`).send({}).expect(201);
    advance(5);
    await request(server).post(`/timers/${id}/stop`).send({}).expect(201);

    const result = await day();
    expect(result.logs.map((log) => log.minutes)).toEqual([10, 5]);
    expect(result.totalMinutes).toBe(15);
    expect(result.logs[0]).toMatchObject({
      title: 'Schreiben',
      source: 'timer',
    });
  });

  it('stops counting at the deadline of a finished timer', async () => {
    await start(await todo());
    advance(90);
    await request(server).get('/timers/current').expect(200);
    expect((await day()).logs.map((log) => log.minutes)).toEqual([60]);
  });

  it('adds a manual entry, corrects and deletes it', async () => {
    const created = await add(await todo(), 60, 30).expect(201);
    const log = created.body as Log;
    expect(log).toMatchObject({ minutes: 30, source: 'manual' });

    await request(server)
      .patch(`/work-logs/${log.id}`)
      .send({ startedAt: iso(50), endedAt: iso(30) })
      .expect(200);
    expect((await day()).totalMinutes).toBe(20);

    await request(server).delete(`/work-logs/${log.id}`).expect(204);
    expect((await day()).logs).toEqual([]);
  });

  it('counts overlapping entries once in the total', async () => {
    const id = await todo();
    await add(id, 60, 30).expect(201);
    await add(id, 45, 15).expect(201);
    expect(await day()).toMatchObject({ totalMinutes: 45 });
  });

  it('rejects invalid ranges and foreign data', async () => {
    const id = await todo();
    await add(id, 30, 60).expect(400);
    await add(id, 30, -5).expect(400);
    await add(424242, 30, 10).expect(404);

    const foreign = await db.getRepository(WorkLogEntity).save({
      userId: OTHER_USER,
      todoId: 1,
      occurrenceId: null,
      title: 'Fremd',
      startedAt: new Date(iso(30)),
      endedAt: new Date(iso(10)),
      source: 'manual',
    });
    expect((await day()).logs).toEqual([]);
    await request(server).delete(`/work-logs/${foreign.id}`).expect(404);
    await request(server)
      .patch(`/work-logs/${foreign.id}`)
      .send({ startedAt: iso(20), endedAt: iso(10) })
      .expect(404);
  });
});
