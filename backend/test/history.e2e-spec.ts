import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import plainRequest from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { UserEntity } from '../src/auth/auth.entities';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../src/habits/entities/habit-schedule-version.entity';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../src/habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';
import { HistoryResponse } from '../src/history/history.dto';
import { getCurrentDateInTimeZone } from '../src/common/date/date-only.utils';
const OTHER = '22222222-2222-4222-8222-222222222222';
describe('History API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let db: DataSource;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
  });
  beforeEach(async () => {
    if (db.options.database !== 'habit_tracker_test')
      throw new Error('Refusing non-test DB');
    await db.query(
      'TRUNCATE push_deliveries, push_subscriptions, timers, habit_occurrences, habit_schedule_versions, habits, todos, auth_sessions, auth_tokens, users RESTART IDENTITY CASCADE',
    );
    await seedAuth(app);
    await db.getRepository(UserEntity).save({
      id: OTHER,
      email: 'other@example.test',
      passwordHash: 'test-only',
      verifiedAt: new Date(),
    });
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  async function todo(overrides: Partial<TodoEntity> = {}) {
    return db.getRepository(TodoEntity).save({
      userId: TEST_USER,
      title: 'Artikel',
      completed: true,
      completedAt: new Date('2026-10-07T12:00:00Z'),
      scheduledAt: null,
      plannedDurationMinutes: 30,
      ...overrides,
    });
  }
  async function occurrence(
    overrides: Partial<HabitOccurrenceEntity> = {},
    habitChanges: Partial<HabitEntity> = {},
  ) {
    const habit = await db.getRepository(HabitEntity).save({
      userId: TEST_USER,
      title: 'Joggen',
      isActive: true,
      plannedDurationMinutes: 20,
      ...habitChanges,
    });
    const version = await db.getRepository(HabitScheduleVersionEntity).save({
      habitId: habit.id,
      type: HabitScheduleType.INTERVAL,
      intervalDays: 2,
      effectiveAt: new Date('2026-10-01T00:00:00Z'),
      firstDueDate: '2026-10-01',
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    });
    return db.getRepository(HabitOccurrenceEntity).save({
      habitId: habit.id,
      scheduleVersionId: version.id,
      scheduledDate: '2026-10-05',
      status: Status.COMPLETED,
      resolvedDate: '2026-10-07',
      resolvedAt: new Date('2026-10-07T15:00:00Z'),
      ...overrides,
    });
  }
  async function get(query = 'date=2026-10-07') {
    const response = await request(server).get(`/history?${query}`).expect(200);
    return response.body as HistoryResponse;
  }
  it('requires authentication', async () => {
    await plainRequest(server).get('/history').expect(401);
  });
  it('defaults to the current Berlin day and includes an empty day', async () => {
    const body = await get('');
    expect(body.today).toBe(getCurrentDateInTimeZone());
    expect(body.days).toEqual([{ date: body.today, items: [] }]);
    expect(body.timeZone).toBe('Europe/Berlin');
  });
  it.each([
    'date=07.10.2026',
    'date=2026-02-30',
    'date=',
    'date=0000-01-01',
    'date=9999-12-31',
    'date=9999-12-30&view=week',
    'date=2026-10-07&view=month',
    'filter=unknown',
    'date=2026-10-07&extra=1',
    'date=2026-10-07&date=2026-10-08',
  ])('rejects invalid query %s', async (query) => {
    await request(server).get(`/history?${query}`).expect(400);
  });
  it('places scheduled and dump Todos on their actual completion day', async () => {
    const dump = await todo();
    const scheduled = await todo({
      title: 'Termin',
      scheduledAt: new Date('2026-10-05T08:00:00Z'),
    });
    const body = await get();
    expect(body.days[0].items.map((item) => item.id).sort()).toEqual(
      [dump.id, scheduled.id].sort(),
    );
    expect(
      body.days[0].items.find((item) => item.id === dump.id)?.scheduledDate,
    ).toBeNull();
    expect(
      body.days[0].items.find((item) => item.id === scheduled.id)
        ?.scheduledDate,
    ).toBe('2026-10-05');
    expect((await get('date=2026-10-05')).days[0].items).toEqual([]);
  });
  it('uses Berlin midnight boundaries, not UTC midnight', async () => {
    await todo({
      title: 'Inside',
      completedAt: new Date('2026-10-06T22:00:00Z'),
    });
    await todo({
      title: 'Before',
      completedAt: new Date('2026-10-06T21:59:59Z'),
    });
    await todo({
      title: 'After',
      completedAt: new Date('2026-10-07T22:00:00Z'),
    });
    expect((await get()).days[0].items.map((item) => item.title)).toEqual([
      'Inside',
    ]);
  });
  it('handles the short spring DST day', async () => {
    await todo({
      title: 'Start',
      completedAt: new Date('2026-03-28T23:00:00Z'),
    });
    await todo({ title: 'End', completedAt: new Date('2026-03-29T21:59:59Z') });
    await todo({
      title: 'Next',
      completedAt: new Date('2026-03-29T22:00:00Z'),
    });
    expect(
      (await get('date=2026-03-29')).days[0].items.map((item) => item.title),
    ).toEqual(['Start', 'End']);
  });
  it('handles the long autumn DST day', async () => {
    await todo({
      title: 'Start',
      completedAt: new Date('2026-10-24T22:00:00Z'),
    });
    await todo({ title: 'End', completedAt: new Date('2026-10-25T22:59:59Z') });
    await todo({
      title: 'Next',
      completedAt: new Date('2026-10-25T23:00:00Z'),
    });
    expect(
      (await get('date=2026-10-25')).days[0].items.map((item) => item.title),
    ).toEqual(['Start', 'End']);
  });
  it('uses completion day for late Habits, planned day for skips, and excludes cancellations/pending', async () => {
    await occurrence();
    await occurrence({
      status: Status.SKIPPED,
      scheduledDate: '2026-10-05',
      resolvedAt: null,
    });
    await occurrence({
      status: Status.SKIPPED,
      scheduledDate: '2026-10-07',
      resolvedDate: '2026-10-09',
      resolvedAt: null,
    });
    await occurrence({
      status: Status.PENDING,
      resolvedDate: null,
      resolvedAt: null,
    });
    await occurrence({
      status: Status.CANCELLED,
      cancellationReason: 'schedule_changed',
    });
    expect(
      (await get()).days[0].items.map((item) => item.status).sort(),
    ).toEqual(['completed', 'skipped']);
    const monday = (await get('date=2026-10-05')).days[0].items;
    expect(monday).toHaveLength(1);
    expect(monday[0].status).toBe('skipped');
  });
  it('keeps resolved soft-deleted and paused entries but never exposes another user', async () => {
    const t = await todo();
    await db.getRepository(TodoEntity).softDelete(t.id);
    const o = await occurrence({}, { isActive: false });
    await db.getRepository(HabitEntity).softDelete(o.habitId);
    await todo({ userId: OTHER, title: 'Private Todo' });
    await occurrence(
      {},
      { userId: OTHER, title: 'Private Habit', deletedAt: new Date() },
    );
    const items = (await get()).days[0].items;
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.deleted)).toBe(true);
  });
  it('never generates occurrences, including for a past day or future schedule', async () => {
    const o = await occurrence({
      status: Status.PENDING,
      resolvedDate: null,
      resolvedAt: null,
    });
    const before = await db.getRepository(HabitOccurrenceEntity).find();
    await get('date=2026-10-01&view=week');
    await get('date=2027-01-01&view=week');
    expect(await db.getRepository(HabitOccurrenceEntity).find()).toEqual(
      before,
    );
    expect((await get()).days[0].items.some((item) => item.id === o.id)).toBe(
      false,
    );
  });
  it('returns Monday through Sunday, including empty days and filters', async () => {
    await todo();
    await occurrence();
    const week = await get('date=2026-10-11&view=week');
    expect(week.startDate).toBe('2026-10-05');
    expect(week.endDate).toBe('2026-10-11');
    expect(week.days).toHaveLength(7);
    expect(
      (await get('date=2026-10-07&filter=todos')).days[0].items.map(
        (item) => item.type,
      ),
    ).toEqual(['todo']);
    expect(
      (await get('date=2026-10-07&filter=habits')).days[0].items.map(
        (item) => item.type,
      ),
    ).toEqual(['habit']);
  });
  it('returns year-crossing weeks', async () => {
    const body = await get('date=2027-01-01&view=week');
    expect(body.startDate).toBe('2026-12-28');
    expect(body.endDate).toBe('2027-01-03');
  });
  it('does not invent timestamps for older completed Habits and prefers occurrence duration', async () => {
    await occurrence({ resolvedAt: null, plannedDurationMinutes: 12 });
    const item = (await get()).days[0].items[0];
    expect(item.resolvedAt).toBeNull();
    expect(item.plannedDurationMinutes).toBe(12);
  });
  it('removes reopened Todos and preserves a repeated completion timestamp', async () => {
    const created = await request(server)
      .post('/todos')
      .send({ title: 'Dump' })
      .expect(201);
    const id = (created.body as { id: number }).id;
    await request(server)
      .patch(`/todos/${id}`)
      .send({ completed: true })
      .expect(200);
    const first = (await get('')).days[0].items[0];
    expect(first.id).toBe(id);
    expect(first.scheduledDate).toBeNull();
    expect(first.resolvedAt).not.toBeNull();
    await request(server)
      .patch(`/todos/${id}`)
      .send({ completed: true })
      .expect(200);
    expect((await get('')).days[0].items[0].resolvedAt).toBe(first.resolvedAt);
    await request(server)
      .patch(`/todos/${id}`)
      .send({ completed: false })
      .expect(200);
    expect((await get('')).days[0].items).toEqual([]);
  });
  it('records the precise completion time of new Habit actions and clears it on reopen', async () => {
    const response = await request(server)
      .post('/habits')
      .send({
        title: 'Gitarre',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);
    const habitId = (response.body as { id: number }).id;
    const todayResponse = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const id = (todayResponse.body as { id: number; habitId: number }[]).find(
      (item) => item.habitId === habitId,
    )!.id;
    await request(server)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status: 'completed' })
      .expect(200);
    const item = (await get('')).days[0].items[0];
    expect(item.resolvedAt).not.toBeNull();
    expect(item.date).toBe(getCurrentDateInTimeZone());
    const instant = item.resolvedAt;
    await request(server)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status: 'completed' })
      .expect(200);
    expect((await get('')).days[0].items[0].resolvedAt).toBe(instant);
    await request(server)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status: 'pending' })
      .expect(200);
    expect((await get('')).days[0].items).toEqual([]);
    expect(
      (await db.getRepository(HabitOccurrenceEntity).findOneByOrFail({ id }))
        .resolvedAt,
    ).toBeNull();
  });
});
