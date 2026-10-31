import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

type Preview = {
  confirmationToken: string;
  dayEnd: string;
  changes: { todoId: number; pieces: unknown[]; tomorrow: unknown }[];
};

describe('Day replanning (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const now = new Date('2026-10-30T06:00:00.000Z');
  const todo = async (
    scheduledAt: string,
    plannedDurationMinutes: number,
    isFixed = false,
  ): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({
            title: 'Eintrag',
            scheduledAt,
            plannedDurationMinutes,
            isFixed,
          })
          .expect(201)
      ).body as { id: number }
    ).id;
  const preview = async (): Promise<Preview> =>
    (await request(server).get('/todos/replan').expect(200)).body as Preview;

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
    await db.query('TRUNCATE timers, todos, habits CASCADE');
    await db
      .createQueryBuilder()
      .update(UserEntity)
      .set({ dayEndMinutes: 1320 })
      .execute();
  });
  afterAll(() => app.close());

  it('plans around a habit with a fixed time', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        plannedDurationMinutes: 60,
        timeOfDay: '09:00',
        schedule: {
          type: 'interval',
          intervalDays: 1,
          missedOccurrencePolicy: 'carry_over',
        },
      })
      .expect(201);
    await request(server).get('/day-planner/today').expect(200);
    await todo('2026-10-30T07:30:00.000Z', 60);

    const { changes } = await preview();
    expect(changes).toHaveLength(1);
    expect(changes[0].pieces).toEqual([
      { start: '2026-10-30T07:30:00.000Z', minutes: 30 },
      { start: '2026-10-30T09:00:00.000Z', minutes: 30 },
    ]);
  });

  it('previews without writing, then splits and keeps the fixed todo', async () => {
    const flexible = await todo('2026-10-30T07:30:00.000Z', 90);
    const fixed = await todo('2026-10-30T08:00:00.000Z', 60, true);
    const before = await db.getRepository(TodoEntity).find();

    const proposal = await preview();
    expect(proposal.dayEnd).toBe('22:00');
    expect(proposal.changes).toHaveLength(1);
    expect(await db.getRepository(TodoEntity).find()).toEqual(before);

    await request(server)
      .post('/todos/replan')
      .send({ confirmationToken: proposal.confirmationToken })
      .expect(204);

    const after = await db
      .getRepository(TodoEntity)
      .find({ order: { id: 'ASC' } });
    expect(after).toHaveLength(3);
    expect(after[0]).toMatchObject({
      id: flexible,
      plannedDurationMinutes: 30,
    });
    expect(after[1]).toMatchObject({
      id: fixed,
      scheduledAt: new Date('2026-10-30T08:00:00.000Z'),
    });
    expect(after[2]).toMatchObject({
      parentId: flexible,
      title: 'Eintrag (Fortsetzung)',
      plannedDurationMinutes: 60,
      scheduledAt: new Date('2026-10-30T09:00:00.000Z'),
    });
    expect((await preview()).changes).toEqual([]);
  });

  it('refuses a stale preview and changes nothing', async () => {
    await todo('2026-10-30T07:30:00.000Z', 90);
    await todo('2026-10-30T08:00:00.000Z', 60, true);
    const proposal = await preview();
    await todo('2026-10-30T09:00:00.000Z', 30, true);
    await request(server)
      .post('/todos/replan')
      .send({ confirmationToken: proposal.confirmationToken })
      .expect(409);
    expect(await db.getRepository(TodoEntity).count()).toBe(3);
  });

  it('moves work past the configurable day end to tomorrow', async () => {
    const id = await todo('2026-10-30T16:00:00.000Z', 120);
    expect((await preview()).changes).toEqual([]);

    await request(server)
      .put('/todos/replan/day-end')
      .send({ dayEnd: '18:00' })
      .expect(204);
    const proposal = await preview();
    expect(proposal.dayEnd).toBe('18:00');
    expect(proposal.changes[0]).toMatchObject({
      todoId: id,
      pieces: [],
      tomorrow: { start: '2026-10-31T16:00:00.000Z', minutes: 120 },
    });

    await request(server)
      .post('/todos/replan')
      .send({ confirmationToken: proposal.confirmationToken })
      .expect(204);
    expect(
      await db.getRepository(TodoEntity).findOneByOrFail({ id }),
    ).toMatchObject({ scheduledAt: new Date('2026-10-31T16:00:00.000Z') });
  });

  it('rejects an invalid day end', async () => {
    await request(server)
      .put('/todos/replan/day-end')
      .send({ dayEnd: '25:00' })
      .expect(400);
  });
});
