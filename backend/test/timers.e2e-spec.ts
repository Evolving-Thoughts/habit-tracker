import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { authenticatedRequest, seedAuth, TEST_USER } from './auth-fixture';
import { Clock } from '../src/common/clock';
import { TimerEntity } from '../src/timers/timer.entity';
import { WorkLogEntity } from '../src/work-logs/work-log.entity';
import type { TimerResponse } from '../src/timers/timers.service';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { UserEntity } from '../src/auth/auth.entities';
import {
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from '../src/common/date/date-only.utils';
import { addDays, dayOf } from '../src/common/date/local-day';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { StartTimerDto } from '../src/timers/timer.dto';
describe('Synced timers and Dump completion (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let now: Date;
  const clock = {
    now: () => new Date(now),
    today: () => dayOf(new Date(now)),
  };
  const client = () => authenticatedRequest(server);
  const read = async () =>
    (await client().get('/timers/current').expect(200)).body as TimerResponse;
  const start = async (input: StartTimerDto) =>
    (await client().post('/timers').send(input).expect(201))
      .body as TimerResponse;
  const action = async (id: string, kind: string) =>
    (await client().post(`/timers/${id}/${kind}`).send({}).expect(201))
      .body as TimerResponse;
  async function todo(minutes = 2) {
    const response = await client()
      .post('/todos')
      .send({ title: 'Schreiben', plannedDurationMinutes: minutes })
      .expect(201);
    return (response.body as { id: number }).id;
  }
  async function habit(overrides: object = {}) {
    return (
      await client()
        .post('/habits')
        .send({
          title: 'Gitarre',
          plannedDurationMinutes: 10,
          schedule: { type: 'interval', intervalDays: 1 },
          ...overrides,
        })
        .expect(201)
    ).body as HabitResponseDto;
  }
  const planner = async () =>
    (await client().get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
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
    if (db.options.database !== 'habit_tracker_test')
      throw new Error('Test DB required');
  });
  async function clear() {
    await db.query(
      'TRUNCATE TABLE external_calendars, calendar_links, calendar_connections, calendar_oauth_states, external_events, push_deliveries, push_subscriptions, timers, habit_occurrences, habit_schedule_versions, habits, todos, categories, reflections, week_reviews, work_logs, goal_snapshots, auth_tokens, auth_sessions, auth_rate_limits, users RESTART IDENTITY',
    );
  }
  beforeEach(async () => {
    await clear();
    await seedAuth(app);
    now = new Date();
  });
  afterAll(async () => {
    if (db?.isInitialized) await clear();
    await app?.close();
  });
  const MINUTE = 60_000;
  const later = (milliseconds: number): void => {
    now = new Date(now.getTime() + milliseconds);
  };
  const logs = () =>
    db.getRepository(WorkLogEntity).find({ order: { startedAt: 'ASC' } });

  it('counts up from the start, takes the planned minutes as target and retries idempotently', async () => {
    const id = await todo();
    const first = await start({ kind: 'todo', targetId: id });
    expect(first.timer).toMatchObject({
      state: 'running',
      elapsedMilliseconds: 0,
      targetMinutes: 2,
      targetReachedAt: null,
    });
    later(30_000);
    const retry = await start({ kind: 'todo', targetId: id });
    expect(retry.timer?.id).toBe(first.timer?.id);
    expect(retry.timer?.elapsedMilliseconds).toBe(30_000);
    expect(await db.getRepository(TimerEntity).count()).toBe(1);
  });
  it('runs without a planned duration', async () => {
    const id = (
      (await client().post('/todos').send({ title: 'Offen' }).expect(201))
        .body as { id: number }
    ).id;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    expect(timer).toMatchObject({ state: 'running', targetMinutes: null });
    later(45 * MINUTE);
    expect((await read()).timer).toMatchObject({
      state: 'running',
      elapsedMilliseconds: 45 * MINUTE,
      targetReachedAt: null,
    });
  });
  it('pauses, survives a long device absence, then counts on from the saved time', async () => {
    const id = await todo();
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(90_123);
    const paused = await action(timer.id, 'pause');
    expect(paused.timer).toMatchObject({
      state: 'paused',
      elapsedMilliseconds: 90_123,
    });
    later(3_600_000);
    expect((await read()).timer).toMatchObject({
      state: 'paused',
      elapsedMilliseconds: 90_123,
    });
    await action(timer.id, 'resume');
    // A repeated resume does not start a second stretch.
    await action(timer.id, 'resume');
    later(10_000);
    expect((await read()).timer?.elapsedMilliseconds).toBe(100_123);
  });
  it('marks the target as reached, keeps running past it and completes nothing', async () => {
    const id = await todo(1);
    const started = now;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(61_000);
    expect((await read()).timer).toMatchObject({
      id: timer.id,
      state: 'running',
      elapsedMilliseconds: 61_000,
      targetReachedAt: new Date(started.getTime() + MINUTE).toISOString(),
    });
    later(5 * MINUTE);
    expect((await read()).timer?.elapsedMilliseconds).toBe(361_000);
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id })).completed,
    ).toBe(false);
    // The stopwatch still holds the one active slot.
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: await todo() })
      .expect(409);
  });
  it('logs every stretch as work, split at each pause', async () => {
    const id = await todo();
    const first = now;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(10 * MINUTE);
    await action(timer.id, 'pause');
    later(60 * MINUTE);
    const second = now;
    await action(timer.id, 'resume');
    later(5 * MINUTE);
    await action(timer.id, 'stop');
    expect(
      (await logs()).map(({ startedAt, endedAt, source, todoId }) => ({
        startedAt,
        endedAt,
        source,
        todoId,
      })),
    ).toEqual([
      {
        startedAt: first,
        endedAt: new Date(first.getTime() + 10 * MINUTE),
        source: 'timer',
        todoId: id,
      },
      {
        startedAt: second,
        endedAt: new Date(second.getTime() + 5 * MINUTE),
        source: 'timer',
        todoId: id,
      },
    ]);
  });
  it('continues the block after a pause under a minute and drops a lone stretch under a minute', async () => {
    const id = await todo(30);
    const first = now;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(5 * MINUTE);
    await action(timer.id, 'pause');
    later(30_000);
    await action(timer.id, 'resume');
    later(2 * MINUTE);
    // The short pause counts as worked.
    expect((await read()).timer?.elapsedMilliseconds).toBe(7.5 * MINUTE);
    await action(timer.id, 'pause');
    later(5 * MINUTE);
    await action(timer.id, 'resume');
    later(20_000);
    await action(timer.id, 'stop');
    expect(
      (await logs()).map(({ startedAt, endedAt }) => ({ startedAt, endedAt })),
    ).toEqual([
      {
        startedAt: first,
        endedAt: new Date(first.getTime() + 7.5 * MINUTE),
      },
    ]);
  });
  it('counts on from the time already logged when the target is started again', async () => {
    const id = await todo(10);
    const first = (await start({ kind: 'todo', targetId: id })).timer!;
    later(4 * MINUTE);
    await action(first.id, 'stop');
    later(60 * MINUTE);
    const again = (await start({ kind: 'todo', targetId: id })).timer!;
    expect(again).toMatchObject({
      elapsedMilliseconds: 4 * MINUTE,
      targetMinutes: 10,
      targetReachedAt: null,
    });
    later(6 * MINUTE);
    expect((await read()).timer?.targetReachedAt).toBe(now.toISOString());
  });
  it('starts a reopened quest worked past its target as reached, without a notification', async () => {
    const id = await todo(2);
    await start({ kind: 'todo', targetId: id });
    later(3 * MINUTE);
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    await client().patch(`/todos/${id}`).send({ completed: false }).expect(200);
    later(MINUTE);
    const reopened = (await start({ kind: 'todo', targetId: id })).timer!;
    expect(reopened).toMatchObject({
      elapsedMilliseconds: 3 * MINUTE,
      targetReachedAt: now.toISOString(),
    });
    const stored = await db
      .getRepository(TimerEntity)
      .findOneByOrFail({ id: reopened.id });
    expect(stored.pushHandledAt).toEqual(now);
    expect(stored.targetReachesAt).toBeNull();
  });
  it('cuts a stopwatch nobody ended after twelve hours and leaves it paused', async () => {
    const id = await todo();
    const started = now;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(30 * 3_600_000);
    expect((await read()).timer).toMatchObject({
      id: timer.id,
      state: 'paused',
      elapsedMilliseconds: 12 * 3_600_000,
    });
    const [log] = await logs();
    expect(log.startedAt).toEqual(started);
    expect(log.endedAt).toEqual(new Date(started.getTime() + 12 * 3_600_000));
    expect(await logs()).toHaveLength(1);
  });
  it('logs the work once, and not past the limit, when a timer runs into an expired occurrence', async () => {
    await habit();
    const occurrence = (await planner()).items.find(
      (item) => item.type === 'habit',
    );
    const started = now;
    await start({ kind: 'occurrence', targetId: occurrence!.occurrenceId });
    later(36 * 3_600_000);
    expect((await read()).timer).toBeNull();
    const stored = await logs();
    expect(stored).toHaveLength(1);
    expect(stored[0].startedAt).toEqual(started);
    expect(stored[0].endedAt).toEqual(
      new Date(started.getTime() + 12 * 3_600_000),
    );
  });
  it('allows only one timer across simultaneous devices, including paused timers', async () => {
    const a = await todo(),
      b = await todo();
    const results = await Promise.all([
      client().post('/timers').send({ kind: 'todo', targetId: a }),
      client().post('/timers').send({ kind: 'todo', targetId: b }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const timer = (await read()).timer!;
    await action(timer.id, 'pause');
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: timer.targetId === a ? b : a })
      .expect(409);
    expect(
      await db.getRepository(TimerEntity).countBy({ state: 'paused' }),
    ).toBe(1);
  });
  it('requires the exact active ID for switching and rolls back invalid replacements', async () => {
    const a = await todo(),
      b = await todo();
    const first = (await start({ kind: 'todo', targetId: a })).timer!;
    await client()
      .post('/timers')
      .send({
        kind: 'todo',
        targetId: b,
        replaceTimerId: '22222222-2222-4222-8222-222222222222',
      })
      .expect(409);
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: 99999, replaceTimerId: first.id })
      .expect(404);
    expect((await read()).timer?.id).toBe(first.id);
    const second = (
      await start({ kind: 'todo', targetId: b, replaceTimerId: first.id })
    ).timer!;
    expect((await action(first.id, 'stop')).timer?.id).toBe(second.id);
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id: a })).completed,
    ).toBe(false);
  });
  it('rejects a duration sent with the start: the target comes from the quest', async () => {
    const id = await todo();
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: id, durationMinutes: 5 })
      .expect(400);
  });
  it('changes the target while running or paused, keeps the time worked and stores it on the Todo', async () => {
    const id = await todo();
    const started = now;
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(30_000);
    const running = (
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes: 3 })
        .expect(200)
    ).body as TimerResponse;
    expect(running.timer).toMatchObject({
      state: 'running',
      targetMinutes: 3,
      elapsedMilliseconds: 30_000,
      targetReachedAt: null,
    });
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id }))
        .plannedDurationMinutes,
    ).toBe(3);
    // The new target is reached three minutes after the start.
    later(150_000);
    expect((await read()).timer?.targetReachedAt).toBe(
      new Date(started.getTime() + 3 * MINUTE).toISOString(),
    );
    await action(timer.id, 'pause');
    const raised = (
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes: 10 })
        .expect(200)
    ).body as TimerResponse;
    expect(raised.timer).toMatchObject({
      state: 'paused',
      targetMinutes: 10,
      elapsedMilliseconds: 180_000,
      targetReachedAt: null,
    });
  });
  it('counts a lowered target that is already worked as reached right away', async () => {
    const id = await todo(3);
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    later(90_000);
    const response = (
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes: 1 })
        .expect(200)
    ).body as TimerResponse;
    expect(response.timer).toMatchObject({
      state: 'running',
      targetMinutes: 1,
      targetReachedAt: now.toISOString(),
    });
  });
  it('stops idempotently, keeps saved duration and does not complete the target', async () => {
    const id = await todo();
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    expect((await action(timer.id, 'stop')).timer).toBeNull();
    expect((await action(timer.id, 'stop')).timer).toBeNull();
    expect(
      await db.getRepository(TodoEntity).findOneByOrFail({ id }),
    ).toMatchObject({ completed: false, plannedDurationMinutes: 2 });
    expect((await start({ kind: 'todo', targetId: id })).timer?.id).not.toBe(
      timer.id,
    );
  });
  it('stores Habit duration only on the concrete occurrence and exposes an eligible play target', async () => {
    const h = await habit();
    const available = (await client().get(`/habits/${h.id}`).expect(200))
      .body as HabitResponseDto;
    expect(available.timerOccurrenceId).toEqual(expect.any(Number));
    expect(available.timerDurationMinutes).toBe(10);
    const timer = (
      await start({
        kind: 'occurrence',
        targetId: available.timerOccurrenceId!,
      })
    ).timer!;
    await action(timer.id, 'pause');
    await client()
      .patch(`/timers/${timer.id}/duration`)
      .send({ durationMinutes: 12 })
      .expect(200);
    expect(
      (await db.getRepository(HabitEntity).findOneByOrFail({ id: h.id }))
        .plannedDurationMinutes,
    ).toBe(10);
    expect(
      (
        await db
          .getRepository(HabitOccurrenceEntity)
          .findOneByOrFail({ id: available.timerOccurrenceId! })
      ).plannedDurationMinutes,
    ).toBe(12);
    expect((await planner()).items[0]).toMatchObject({
      plannedDurationMinutes: 12,
    });
  });
  it('does not offer or start timers for future/paused/resolved Habit occurrences', async () => {
    const future = await habit({
      startDate: addDays(getCurrentDateInTimeZone(), 2),
    });
    expect(
      (
        (await client().get(`/habits/${future.id}`).expect(200))
          .body as HabitResponseDto
      ).timerOccurrenceId,
    ).toBeNull();
    const h = await habit();
    const available = (await client().get(`/habits/${h.id}`).expect(200))
      .body as HabitResponseDto;
    const occurrence = available.timerOccurrenceId!;
    await client()
      .patch(`/habits/${h.id}`)
      .send({ isActive: false })
      .expect(200);
    await client()
      .post('/timers')
      .send({ kind: 'occurrence', targetId: occurrence })
      .expect(409);
    await client()
      .patch(`/habits/${h.id}`)
      .send({ isActive: true })
      .expect(200);
    const active = (await client().get(`/habits/${h.id}`).expect(200))
      .body as HabitResponseDto;
    await client()
      .patch(`/habit-occurrences/${active.timerOccurrenceId!}/status`)
      .send({ status: 'completed' })
      .expect(200);
    await client()
      .post('/timers')
      .send({ kind: 'occurrence', targetId: active.timerOccurrenceId! })
      .expect(409);
  });
  it('clears a running timer when the target is completed or deleted', async () => {
    const id = await todo();
    await start({ kind: 'todo', targetId: id });
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    expect((await read()).timer).toBeNull();
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: id })
      .expect(409);
    const next = await todo();
    await start({ kind: 'todo', targetId: next });
    const snapshot = await client()
      .get(`/todos/${next}/deletion-preview`)
      .expect(200);
    const token = (snapshot.body as { confirmationToken: string })
      .confirmationToken;
    await client()
      .delete(`/todos/${next}`)
      .send({ confirmationToken: token })
      .expect(204);
    expect((await read()).timer).toBeNull();
  });
  it('stops the stored timer in the same request that ends its target', async () => {
    // No later read may be needed: the row itself is stopped immediately.
    const stored = async () =>
      (await db.getRepository(TimerEntity).find())
        .filter((t) => t.state !== 'stopped')
        .map((t) => t.state);
    const id = await todo();
    await start({ kind: 'todo', targetId: id });
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    expect(await stored()).toEqual([]);
    const h = await habit();
    const available = (await client().get(`/habits/${h.id}`).expect(200))
      .body as HabitResponseDto;
    await start({ kind: 'occurrence', targetId: available.timerOccurrenceId! });
    await client().delete(`/habits/${h.id}`).expect(204);
    expect(await stored()).toEqual([]);
  });
  it('stops when the linked Habit is paused or its occurrence is skipped', async () => {
    const h = await habit();
    const getAvailable = async () =>
      (await client().get(`/habits/${h.id}`).expect(200))
        .body as HabitResponseDto;
    const available = await getAvailable();
    await start({ kind: 'occurrence', targetId: available.timerOccurrenceId! });
    await client()
      .patch(`/habits/${h.id}`)
      .send({ isActive: false })
      .expect(200);
    expect((await read()).timer).toBeNull();
    await client()
      .patch(`/habits/${h.id}`)
      .send({ isActive: true })
      .expect(200);
    const again = await getAvailable();
    await start({ kind: 'occurrence', targetId: again.timerOccurrenceId! });
    await client()
      .patch(`/habit-occurrences/${again.timerOccurrenceId!}/status`)
      .send({ status: 'skipped' })
      .expect(200);
    expect((await read()).timer).toBeNull();
  });
  it('validates and clears Habit default duration independently of schedule versions', async () => {
    const h = await habit();
    for (const minutes of [0, -1, 1.5, 10081])
      await client()
        .patch(`/habits/${h.id}`)
        .send({ plannedDurationMinutes: minutes })
        .expect(400);
    await client()
      .patch(`/habits/${h.id}`)
      .send({ plannedDurationMinutes: null })
      .expect(200);
    expect(
      (await db.getRepository(HabitEntity).findOneByOrFail({ id: h.id }))
        .plannedDurationMinutes,
    ).toBeNull();
  });
  it('rejects anonymous/foreign timer access and foreign targets', async () => {
    await anonymous(server).get('/timers/current').expect(401);
    const other = '22222222-2222-4222-8222-222222222222';
    await db.getRepository(UserEntity).save({
      id: other,
      email: 'other@example.test',
      passwordHash: 'unused',
      verifiedAt: new Date(),
    });
    const foreign = await db.getRepository(TodoEntity).save({
      userId: other,
      title: 'Private',
      completed: false,
      plannedDurationMinutes: 2,
    });
    await client()
      .post('/timers')
      .send({ kind: 'todo', targetId: foreign.id })
      .expect(404);
    const owned = await todo();
    const timer = (await start({ kind: 'todo', targetId: owned })).timer!;
    await db
      .getRepository(TimerEntity)
      .update({ id: timer.id }, { userId: other });
    for (const kind of ['pause', 'resume', 'stop'])
      await client().post(`/timers/${timer.id}/${kind}`).send({}).expect(404);
    expect((await read()).timer).toBeNull();
  });
  it.each([0, -1, 1.5, 10081, null])(
    'rejects %s as target and never accepts a supplied owner',
    async (durationMinutes) => {
      const id = await todo();
      await client()
        .post('/timers')
        .send({ kind: 'todo', targetId: id, userId: TEST_USER })
        .expect(400);
      const timer = (await start({ kind: 'todo', targetId: id })).timer!;
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes })
        .expect(400);
      expect((await read()).timer?.targetMinutes).toBe(2);
    },
  );
  it('preserves Dump completion time after reload, repeat completion and metadata edits', async () => {
    const id = await todo();
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    const saved = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(saved.scheduledDate).toBeNull();
    // Completion uses the injected Clock, not the wall clock.
    expect(saved.completedAt).toEqual(now);
    const item = (await planner()).items.find(
      (i) => i.type === 'todo' && i.todoId === id,
    );
    expect(item).toMatchObject({
      status: 'completed',
      timeOfDay: null,
      completedAt: saved.completedAt!.toISOString(),
      scheduledDate: getCurrentDateInTimeZone(
        'Europe/Berlin',
        saved.completedAt!,
      ),
    });
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    await client()
      .patch(`/todos/${id}`)
      .send({ title: 'Neuer Titel', plannedDurationMinutes: 4 })
      .expect(200);
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id })).completedAt,
    ).toEqual(saved.completedAt);
    await client().patch(`/todos/${id}`).send({ completed: false }).expect(200);
    expect(
      await db.getRepository(TodoEntity).findOneByOrFail({ id }),
    ).toMatchObject({ completedAt: null, scheduledDate: null });
    expect((await planner()).items).toHaveLength(0);
  });
  it('buckets Dump completions at Berlin midnight, not UTC midnight', async () => {
    const date = getCurrentDateInTimeZone();
    const boundary = midnightInTimeZone(date);
    const prior = await todo(),
      today = await todo();
    await db
      .getRepository(TodoEntity)
      .update(
        { id: prior },
        { completed: true, completedAt: new Date(boundary.getTime() - 1) },
      );
    await db
      .getRepository(TodoEntity)
      .update({ id: today }, { completed: true, completedAt: boundary });
    const items = (await planner()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      todoId: today,
      scheduledDate: date,
      timeOfDay: null,
    });
    const historical = await db
      .getRepository(TodoEntity)
      .findOneByOrFail({ id: prior });
    expect(historical.completedAt).toEqual(new Date(boundary.getTime() - 1));
  });
});
