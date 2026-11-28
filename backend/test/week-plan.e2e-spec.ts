import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import plainRequest from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { addDays, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import type {
  WeekPlanEntryDto,
  WeekPlanResponseDto,
} from '../src/day-planner/dto/week-plan.dto';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../src/habits/entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import {
  authenticatedRequest as request,
  SEEDED_AUTH_TABLES,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { HabitForecastPlaceEntity } from '../src/habits/entities/habit-forecast-place.entity';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { resetDatabase } from './reset-database';
import { holdUserLock, within } from './user-lock';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';

describe('Plan board (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  /** A day well ahead, where nothing is generated yet. */
  const nextMonday = addDays(today, 7);

  const todo = async (title: string, body: object = {}): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({ title, scheduledDate: nextMonday, ...body })
          .expect(201)
      ).body as { id: number }
    ).id;
  const week = async (start: string, days = 7): Promise<WeekPlanResponseDto> =>
    (
      await request(server)
        .get(`/day-planner/plan?from=${start}&days=${days}`)
        .expect(200)
    ).body as WeekPlanResponseDto;
  const entriesOn = async (
    start: string,
    date: string,
  ): Promise<WeekPlanEntryDto[]> =>
    (await week(start)).days.find((day) => day.date === date)!.entries;
  const titlesOn = async (start: string, date: string): Promise<string[]> =>
    (await entriesOn(start, date)).map(({ title }) => title);
  const sort = (order: { type: 'todo' | 'habit'; id: number }[]) =>
    request(server).put('/day-planner/order').send({ items: order });
  const foreignTodo = (changes: Partial<TodoEntity>) =>
    db.getRepository(TodoEntity).save({
      userId: OTHER_USER,
      title: 'Fremdes',
      ...changes,
    });

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
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() => resetDatabase(db, { keep: SEEDED_AUTH_TABLES }));
  afterAll(() => app.close());

  it('requires authentication', async () => {
    await plainRequest(server)
      .get(`/day-planner/plan?from=${today}&days=3`)
      .expect(401);
  });

  it.each([
    '',
    `from=${today}`,
    'days=3',
    `from=&days=3`,
    `from=${today}&days=0`,
    `from=${today}&days=32`,
    `from=${today}&days=2.5`,
    `from=${today}&days=drei`,
    'from=2026-02-30&days=3',
    'from=16.11.2026&days=3',
    `from=${today}&days=3&extra=1`,
  ])('rejects the query %p', async (query) => {
    await request(server).get(`/day-planner/plan?${query}`).expect(400);
  });

  it('answers the days asked for, from any weekday, each in the order of its day', async () => {
    const first = await todo('Erstes');
    await todo('Zweites');
    await todo('Zahnarzt', { timeOfDay: '09:30', plannedDurationMinutes: 45 });
    await todo('Mittwochs', { scheduledDate: addDays(nextMonday, 2) });
    const done = await todo('Schon erledigt', { scheduledDate: null });
    await request(server)
      .patch(`/todos/${done}`)
      .send({ completed: true })
      .expect(200);
    await sort([{ type: 'todo', id: first }]).expect(204);

    const body = await week(nextMonday);
    expect(body).toMatchObject({
      startDate: nextMonday,
      endDate: addDays(nextMonday, 6),
      today,
    });
    expect(body.days.map(({ date }) => date)).toEqual(
      Array.from({ length: 7 }, (_, index) => addDays(nextMonday, index)),
    );
    expect(await titlesOn(nextMonday, nextMonday)).toEqual([
      'Zahnarzt',
      'Erstes',
      'Zweites',
    ]);
    expect((await entriesOn(nextMonday, nextMonday))[0]).toMatchObject({
      type: 'todo',
      status: 'pending',
      timeOfDay: '09:30',
      plannedDurationMinutes: 45,
      isOverdue: false,
      campaign: null,
    });
    expect(await titlesOn(nextMonday, addDays(nextMonday, 2))).toEqual([
      'Mittwochs',
    ]);

    // Done today: it sits on today, after what is still open there.
    await todo('Heute offen', { scheduledDate: today });
    expect(await titlesOn(today, today)).toEqual([
      'Heute offen',
      'Schon erledigt',
    ]);
    expect(
      (await week(addDays(today, 2), 3)).days.map(({ date }) => date),
    ).toEqual([addDays(today, 2), addDays(today, 3), addDays(today, 4)]);
  });

  it('keeps overdue quests apart from today, whatever days are shown, and past days only with what was done', async () => {
    const lastWeek = addDays(today, -7);
    await todo('Liegengeblieben', { scheduledDate: lastWeek });
    await todo('Vorgestern', { scheduledDate: addDays(today, -2) });
    await db
      .getRepository(TodoEntity)
      .update(
        { id: await todo('Damals erledigt', { scheduledDate: lastWeek }) },
        { completed: true, completedAt: new Date(`${lastWeek}T10:00:00Z`) },
      );

    expect(await titlesOn(lastWeek, lastWeek)).toEqual(['Damals erledigt']);
    for (const start of [today, nextMonday]) {
      const body = await week(start, 3);
      expect(body.overdue.map(({ title }) => title)).toEqual([
        'Liegengeblieben',
        'Vorgestern',
      ]);
      expect(body.overdue[0]).toMatchObject({
        type: 'todo',
        scheduledDate: lastWeek,
        isOverdue: true,
      });
    }
    expect(await titlesOn(today, today)).toEqual([]);
  });

  it('forecasts dailies on days whose runs are not generated yet', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        plannedDurationMinutes: 20,
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);

    const days = (await week(nextMonday)).days;
    for (const day of days)
      expect(day.entries).toEqual([
        {
          type: 'habit',
          habitId: expect.any(Number) as number,
          occurrenceId: null,
          status: 'pending',
          moveUntil: null,
          timerEligible: false,
          streak: { current: 0, best: 0, unit: 'runs' },
          monthChallenge: false,
          title: 'Laufen',
          timeOfDay: null,
          plannedDurationMinutes: 20,
          campaign: null,
          isOverdue: false,
        },
      ]);
  });

  it('sorts a forecast run among a later day and hands its place to the run on its day', async () => {
    const habitId = (
      (
        await request(server)
          .post('/habits')
          .send({
            title: 'Laufen',
            schedule: { type: 'interval', intervalDays: 1 },
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    const first = await todo('Erstes');
    const second = await todo('Zweites');
    // Unsorted, the forecast follows what is sorted.
    expect(await titlesOn(nextMonday, nextMonday)).toEqual([
      'Erstes',
      'Zweites',
      'Laufen',
    ]);
    await request(server)
      .put('/day-planner/order')
      .send({
        items: [
          { type: 'todo', id: first },
          { type: 'forecast', id: habitId, date: nextMonday },
          { type: 'todo', id: second },
        ],
      })
      .expect(204);
    expect(await titlesOn(nextMonday, nextMonday)).toEqual([
      'Erstes',
      'Laufen',
      'Zweites',
    ]);
    // Still a forecast: nothing is stored before its day.
    const [, run] = await entriesOn(nextMonday, nextMonday);
    expect(run).toMatchObject({ type: 'habit', occurrenceId: null });

    // A forecast needs its day; someone else's habit is not found.
    await request(server)
      .put('/day-planner/order')
      .send({ items: [{ type: 'forecast', id: habitId }] })
      .expect(400);
    const foreign = await db.getRepository(HabitEntity).save({
      userId: OTHER_USER,
      title: 'Fremd',
    });
    await request(server)
      .put('/day-planner/order')
      .send({ items: [{ type: 'forecast', id: foreign.id, date: nextMonday }] })
      .expect(404);

    // On its day the stored run takes the place it waited in.
    await db.query(
      `DELETE FROM habit_occurrences WHERE "habitId" = $1 AND "scheduledDate" = $2`,
      [habitId, today],
    );
    await db.getRepository(HabitForecastPlaceEntity).insert({
      userId: TEST_USER,
      habitId,
      date: today,
      dayPosition: 3,
    });
    await request(server).get('/day-planner/today').expect(200);
    const stored = await db
      .getRepository(HabitOccurrenceEntity)
      .findOneByOrFail({
        habitId,
        scheduledDate: today,
      });
    expect(stored.dayPosition).toBe(3);
    expect(
      await db
        .getRepository(HabitForecastPlaceEntity)
        .countBy({ habitId, date: today }),
    ).toBe(0);
  });

  it("stores today's runs first, so the board sorts, moves and measures them like Heute", async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Lesen',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);

    const [run] = await entriesOn(today, today);
    expect(run).toMatchObject({
      type: 'habit',
      occurrenceId: expect.any(Number) as number,
      status: 'pending',
      moveUntil: today,
      timerEligible: true,
      streak: { current: 0, best: 0, unit: 'runs' },
    });
  });

  // Room for a slow machine: a test cut off mid-way keeps the lock.
  const LOCK_TEST_MS = 20_000;
  it(
    'answers from a snapshot while a change holds the user lock',
    async () => {
      await request(server)
        .post('/habits')
        .send({
          title: 'Lesen',
          schedule: { type: 'interval', intervalDays: 1 },
        })
        .expect(201);
      await todo('Zahnarzt', { scheduledDate: today, timeOfDay: '09:30' });
      // Today's run is stored, so nothing is left to store.
      await week(today, 3);

      const release = await holdUserLock(db, TEST_USER);
      try {
        const plan = await within(week(today, 3), 2_000);
        expect(
          plan.days[0].entries
            .map(({ type, title }) => `${type} ${title}`)
            .sort(),
        ).toEqual(['habit Lesen', 'todo Zahnarzt']);
      } finally {
        await release();
      }
    },
    LOCK_TEST_MS,
  );

  it('orders any day and keeps the order after a move from another day', async () => {
    const first = await todo('Erstes');
    const second = await todo('Zweites');
    const wanderer = await todo('Wanderer', {
      scheduledDate: addDays(nextMonday, 1),
    });
    const appointment = await todo('Termin', {
      scheduledDate: addDays(nextMonday, 1),
      timeOfDay: '15:00',
    });

    // The board moves a quest with the reschedule path, then sorts its new day.
    await request(server)
      .post(`/todos/${wanderer}/reschedule`)
      .send({ date: nextMonday })
      .expect(200);
    await sort([
      { type: 'todo', id: second },
      { type: 'todo', id: wanderer },
      { type: 'todo', id: first },
    ]).expect(204);
    await request(server)
      .post(`/todos/${appointment}/reschedule`)
      .send({ date: nextMonday, confirmFixed: true })
      .expect(200);

    expect(await titlesOn(nextMonday, nextMonday)).toEqual([
      'Termin',
      'Zweites',
      'Wanderer',
      'Erstes',
    ]);
    expect((await entriesOn(nextMonday, nextMonday))[0].timeOfDay).toBe(
      '15:00',
    );
    expect(await titlesOn(nextMonday, addDays(nextMonday, 1))).toEqual([]);
  });

  it('never shows or sorts what belongs to someone else', async () => {
    const own = await todo('Eigenes');
    const foreign = await foreignTodo({ scheduledDate: nextMonday });
    await foreignTodo({
      scheduledDate: null,
      completed: true,
      completedAt: new Date(),
    });
    const habit = await db.getRepository(HabitEntity).save({
      userId: OTHER_USER,
      title: 'Fremdes Daily',
      isActive: true,
    });
    await db.getRepository(HabitScheduleVersionEntity).save({
      habitId: habit.id,
      type: HabitScheduleType.INTERVAL,
      intervalDays: 1,
      effectiveAt: new Date(`${addDays(today, -1)}T00:00:00Z`),
      firstDueDate: addDays(today, -1),
      missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
    });

    for (const start of [today, nextMonday])
      for (const day of (await week(start)).days)
        expect(day.entries.map(({ title }) => title)).not.toEqual(
          expect.arrayContaining(['Fremdes', 'Fremdes Daily']),
        );
    expect(await titlesOn(nextMonday, nextMonday)).toEqual(['Eigenes']);

    await sort([
      { type: 'todo', id: foreign.id },
      { type: 'todo', id: own },
    ]).expect(404);
    const stored = await db
      .getRepository(TodoEntity)
      .findOneByOrFail({ id: foreign.id });
    expect(stored.dayPosition).toBeNull();
  });
});
