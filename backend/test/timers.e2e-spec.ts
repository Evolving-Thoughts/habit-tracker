import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { authenticatedRequest, seedAuth, TEST_USER } from './auth-fixture';
import { TimerClock } from '../src/timers/timer.clock';
import { TimerEntity } from '../src/timers/timer.entity';
import type { TimerResponse } from '../src/timers/timers.service';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { UserEntity } from '../src/auth/auth.entities';
import {
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from '../src/common/date/date-only.utils';
import { HabitScheduleCalculator } from '../src/habit-occurrences/scheduling/habit-schedule-calculator';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { StartTimerDto } from '../src/timers/timer.dto';
describe('Synced timers and Dump completion (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let server: Server;
  let now: Date;
  const clock = { now: () => new Date(now) };
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
      .overrideProvider(TimerClock)
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
      'TRUNCATE TABLE timers, habit_occurrences, habit_schedule_versions, habits, todos, auth_tokens, auth_sessions, auth_rate_limits, users RESTART IDENTITY',
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
  it('starts from the saved duration, persists a deadline and retries idempotently', async () => {
    const id = await todo();
    const first = await start({ kind: 'todo', targetId: id });
    expect(first.timer).toMatchObject({
      state: 'running',
      durationMinutes: 2,
      remainingMilliseconds: 120000,
    });
    expect(first.timer?.endsAt).toBe(
      new Date(now.getTime() + 120000).toISOString(),
    );
    now = new Date(now.getTime() + 30000);
    const retry = await start({ kind: 'todo', targetId: id });
    expect(retry.timer?.id).toBe(first.timer?.id);
    expect(retry.timer?.remainingMilliseconds).toBe(90000);
    expect(await db.getRepository(TimerEntity).count()).toBe(1);
  });
  it('pauses, survives a long device absence, then resumes the saved remainder', async () => {
    const id = await todo();
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    now = new Date(now.getTime() + 30123);
    const paused = await action(timer.id, 'pause');
    expect(paused.timer?.remainingMilliseconds).toBe(89877);
    now = new Date(now.getTime() + 3600000);
    expect((await read()).timer).toMatchObject({
      state: 'paused',
      remainingMilliseconds: 89877,
    });
    const resumed = await action(timer.id, 'resume');
    expect(resumed.timer?.endsAt).toBe(
      new Date(now.getTime() + 89877).toISOString(),
    );
    expect((await action(timer.id, 'resume')).timer?.endsAt).toBe(
      resumed.timer?.endsAt,
    );
  });
  it('expires after absence without completing the target and frees the active slot', async () => {
    const id = await todo(1);
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    now = new Date(now.getTime() + 61000);
    expect((await read()).timer).toMatchObject({
      state: 'finished',
      remainingMilliseconds: 0,
      finishedAt: timer.endsAt,
    });
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id })).completed,
    ).toBe(false);
    const next = await todo();
    expect(
      (await start({ kind: 'todo', targetId: next })).timer?.targetId,
    ).toBe(next);
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
  it('changes total duration only while paused, preserves elapsed time and stores it on the Todo', async () => {
    const id = await todo();
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    await client()
      .patch(`/timers/${timer.id}/duration`)
      .send({ durationMinutes: 3 })
      .expect(409);
    now = new Date(now.getTime() + 30000);
    await action(timer.id, 'pause');
    const result = (
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes: 3 })
        .expect(200)
    ).body as TimerResponse;
    expect(result.timer).toMatchObject({
      state: 'paused',
      durationMinutes: 3,
      remainingMilliseconds: 150000,
    });
    expect(
      (await db.getRepository(TodoEntity).findOneByOrFail({ id }))
        .plannedDurationMinutes,
    ).toBe(3);
  });
  it('finishes if a reduced duration is already fully elapsed', async () => {
    const id = await todo(3);
    const timer = (await start({ kind: 'todo', targetId: id })).timer!;
    now = new Date(now.getTime() + 90000);
    await action(timer.id, 'pause');
    const response = (
      await client()
        .patch(`/timers/${timer.id}/duration`)
        .send({ durationMinutes: 1 })
        .expect(200)
    ).body as TimerResponse;
    expect(response.timer).toMatchObject({
      state: 'finished',
      remainingMilliseconds: 0,
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
      startDate: HabitScheduleCalculator.addDays(getCurrentDateInTimeZone(), 2),
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
    await client().delete(`/todos/${next}`).expect(204);
    expect((await read()).timer).toBeNull();
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
      isFixed: false,
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
    'validates duration %s and never accepts a supplied owner',
    async (durationMinutes) => {
      const id = await todo();
      await client()
        .post('/timers')
        .send({ kind: 'todo', targetId: id, durationMinutes })
        .expect(durationMinutes === null ? 201 : 400);
      await client()
        .post('/timers')
        .send({ kind: 'todo', targetId: id, userId: TEST_USER })
        .expect(400);
    },
  );
  it('preserves Dump completion time after reload, repeat completion and metadata edits', async () => {
    const id = await todo();
    const before = Date.now();
    await client().patch(`/todos/${id}`).send({ completed: true }).expect(200);
    const saved = await db.getRepository(TodoEntity).findOneByOrFail({ id });
    expect(saved.scheduledAt).toBeNull();
    expect(saved.completedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.completedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    const item = (await planner()).items.find(
      (i) => i.type === 'todo' && i.todoId === id,
    );
    expect(item).toMatchObject({
      status: 'completed',
      scheduledAt: null,
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
    ).toMatchObject({ completedAt: null, scheduledAt: null });
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
      scheduledAt: null,
    });
    const historical = await db
      .getRepository(TodoEntity)
      .findOneByOrFail({ id: prior });
    expect(historical.completedAt).toEqual(new Date(boundary.getTime() - 1));
  });
});
