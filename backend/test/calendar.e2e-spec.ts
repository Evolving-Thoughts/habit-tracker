import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { addDays, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import type { HistoryResponse } from '../src/history/history.dto';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

describe('Calendar month view (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  const nextMonth = addDays(`${today.slice(0, 7)}-28`, 7);
  const month = async (date: string): Promise<HistoryResponse> =>
    (await request(server).get(`/history?date=${date}&view=month`).expect(200))
      .body as HistoryResponse;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
  });
  beforeEach(() =>
    db.query(
      'TRUNCATE timers, habit_occurrences, habit_schedule_versions, habits, todos CASCADE',
    ),
  );
  afterAll(() => app.close());

  it('reports the habit quota in the week view only', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);
    const due = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const { id } = (due.body as { id: number }[])[0];
    await request(server)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status: 'completed' })
      .expect(200);

    const week = await request(server)
      .get(`/history?date=${today}&view=week`)
      .expect(200);
    expect((week.body as HistoryResponse).weekQuota).toEqual({
      completed: 1,
      total: 1,
      percentage: 100,
    });
    const day = await request(server)
      .get(`/history?date=${today}&view=day`)
      .expect(200);
    expect((day.body as HistoryResponse).weekQuota).toBeUndefined();
  });

  it('covers exactly the calendar month', async () => {
    const result = await month('2026-02-15');
    expect(result.startDate).toBe('2026-02-01');
    expect(result.endDate).toBe('2026-02-28');
    expect(result.days).toHaveLength(28);
  });

  it('marks forecasts and never generates occurrences', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);
    const before = await db.getRepository(HabitOccurrenceEntity).count();

    const result = await month(nextMonth);

    const planned = result.days[0].planned ?? [];
    expect(planned[0]).toMatchObject({
      type: 'habit',
      id: null,
      moveUntil: null,
    });
    expect(await db.getRepository(HabitOccurrenceEntity).count()).toBe(before);
  });

  it('reports a scheduled todo once with what moving it needs', async () => {
    const target = addDays(nextMonth, 3);
    await request(server)
      .post('/todos')
      .send({
        title: 'Arzt',
        isFixed: true,
        scheduledAt: `${target}T10:00:00.000Z`,
      })
      .expect(201);

    const result = await month(nextMonth);

    const entries = result.days.flatMap((day) => day.planned ?? []);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: target,
      isFixed: true,
      title: 'Arzt',
    });
  });

  it('moves a stored occurrence into its window and reflects it', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        schedule: { type: 'interval', intervalDays: 3 },
      })
      .expect(201);
    const due = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const { id } = (due.body as { id: number }[])[0];
    const target = addDays(today, 1);
    await request(server)
      .post(`/habit-occurrences/${id}/reschedule`)
      .send({ date: target })
      .expect(200);

    const result = await month(target);
    const day = result.days.find((item) => item.date === target);
    expect(day?.planned?.some((item) => item.id === id)).toBe(true);

    // The target day shows it although its slot lies outside that range.
    const single = await request(server)
      .get(`/history?date=${target}&view=day`)
      .expect(200);
    const planned = (single.body as HistoryResponse).days[0].planned;
    expect(planned?.some((item) => item.id === id)).toBe(true);
  });
});
