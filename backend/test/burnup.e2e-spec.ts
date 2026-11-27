import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import {
  authenticatedRequest as request,
  seedAuth,
  SEEDED_AUTH_TABLES,
} from './auth-fixture';
import { resetDatabase } from './reset-database';

type Point = { date: string; doneCount: number; totalCount: number };

describe('Burnup (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  let now: Date;
  const todo = async (title: string, parentId?: number): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({ title, parentId, plannedDurationMinutes: 30 })
          .expect(201)
      ).body as { id: number }
    ).id;
  const complete = (id: number, completed = true) =>
    request(server).patch(`/todos/${id}`).send({ completed }).expect(200);
  const burnup = async (id: number): Promise<Point[]> =>
    (await request(server).get(`/todos/${id}/burnup`).expect(200))
      .body as Point[];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => now, today: () => dayOf(now) })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
  });
  beforeEach(async () => {
    now = new Date('2026-10-30T09:00:00.000Z');
    await resetDatabase(db, { keep: SEEDED_AUTH_TABLES });
  });
  afterAll(() => app.close());

  it('keeps scope growth and a reopen visible across days', async () => {
    const root = await todo('Projekt');
    const first = await todo('Teil 1', root);
    await complete(first);
    await burnup(root);

    now = new Date('2026-10-31T09:00:00.000Z');
    await todo('Teil 2', root);
    await burnup(root);

    now = new Date('2026-11-01T09:00:00.000Z');
    await complete(first, false);
    const points = await burnup(root);

    expect(
      points.map(({ date, doneCount, totalCount }) => [
        date,
        doneCount,
        totalCount,
      ]),
    ).toEqual([
      ['2026-10-30', 1, 1],
      ['2026-10-31', 1, 2],
      ['2026-11-01', 0, 2],
    ]);
  });

  it('keeps one row per day with the latest value', async () => {
    const root = await todo('Projekt');
    const part = await todo('Teil', root);
    await burnup(root);
    await complete(part);
    expect(await burnup(root)).toHaveLength(1);
    expect((await burnup(root))[0]).toMatchObject({
      doneCount: 1,
      totalCount: 1,
    });
  });

  it('counts the quests below a campaign, never the campaign itself', async () => {
    const root = await todo('Projekt');
    await todo('Teil 1', root);
    await todo('Teil 2', root);
    await complete(root);
    expect(await burnup(root)).toEqual([
      {
        date: '2026-10-30',
        doneCount: 0,
        totalCount: 2,
        doneMinutes: 0,
        totalMinutes: 60,
      },
    ]);
  });

  it('only offers roots and only the own ones', async () => {
    const root = await todo('Projekt');
    const child = await todo('Teil', root);
    await request(server).get(`/todos/${child}/burnup`).expect(400);
    await request(server).get('/todos/424242/burnup').expect(404);
  });
});
