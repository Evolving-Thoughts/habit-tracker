import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import plainRequest from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { addDays, dayOf, weekRange } from '../src/common/date/local-day';
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
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';

describe('Week plan (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  const monday = weekRange(today).startDate;
  const nextMonday = addDays(monday, 7);

  const todo = async (title: string, body: object = {}): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({ title, scheduledDate: nextMonday, ...body })
          .expect(201)
      ).body as { id: number }
    ).id;
  const week = async (start: string): Promise<WeekPlanResponseDto> =>
    (await request(server).get(`/day-planner/week?start=${start}`).expect(200))
      .body as WeekPlanResponseDto;
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
  beforeEach(() => db.query('TRUNCATE timers, todos, habits CASCADE'));
  afterAll(() => app.close());

  it('requires authentication', async () => {
    await plainRequest(server)
      .get(`/day-planner/week?start=${monday}`)
      .expect(401);
  });

  it.each([
    '',
    'start=',
    `start=${addDays(monday, 1)}`,
    'start=2026-02-30',
    'start=16.11.2026',
    `start=${monday}&extra=1`,
  ])('rejects the query %p', async (query) => {
    await request(server).get(`/day-planner/week?${query}`).expect(400);
  });

  it('answers seven days from Monday, each in the order of its day', async () => {
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
    expect(await titlesOn(monday, today)).toEqual([
      'Heute offen',
      'Schon erledigt',
    ]);
  });

  it('carries overdue quests to today and shows past days only with what was done', async () => {
    const lastWeek = addDays(monday, -7);
    await todo('Liegengeblieben', { scheduledDate: lastWeek });
    await db
      .getRepository(TodoEntity)
      .update(
        { id: await todo('Damals erledigt', { scheduledDate: lastWeek }) },
        { completed: true, completedAt: new Date(`${lastWeek}T10:00:00Z`) },
      );

    expect(await titlesOn(lastWeek, lastWeek)).toEqual(['Damals erledigt']);
    const carried = (await entriesOn(monday, today)).find(
      ({ title }) => title === 'Liegengeblieben',
    );
    expect(carried).toMatchObject({
      scheduledDate: lastWeek,
      isOverdue: true,
    });
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
          title: 'Laufen',
          timeOfDay: null,
          plannedDurationMinutes: 20,
          campaign: null,
          isOverdue: false,
        },
      ]);
  });

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
      effectiveAt: new Date(`${monday}T00:00:00Z`),
      firstDueDate: monday,
      missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
    });

    for (const start of [monday, nextMonday])
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
