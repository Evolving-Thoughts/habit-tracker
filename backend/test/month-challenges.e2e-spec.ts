import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import anonymous from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { Clock } from '../src/common/clock';
import { atWallClockMinutes, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import type {
  MonthChallengeResponse,
  MonthChallengesResponse,
} from '../src/month-challenges/month-challenge.dto';
import { MonthChallengeEntity } from '../src/month-challenges/month-challenge.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '77777777-7777-4777-8777-777777777777';

describe('Monats-Challenge (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  let now: Date;
  /** Berlin wall clock on `day`. */
  const setNow = (day: string, minutes = 10 * 60) => {
    now = atWallClockMinutes(day, minutes);
  };

  const daily = async (title: string, schedule?: object) =>
    (
      await request(server)
        .post('/habits')
        .send({
          title,
          schedule: schedule ?? {
            type: 'interval',
            intervalDays: 1,
            missedOccurrencePolicy: 'skip',
          },
        })
        .expect(201)
    ).body as HabitResponseDto;
  const start = async (body: object) =>
    (await request(server).post('/month-challenges').send(body).expect(201))
      .body as MonthChallengeResponse;
  const overview = async () =>
    (await request(server).get('/month-challenges').expect(200))
      .body as MonthChallengesResponse;
  const setRun = (id: number, status: 'completed' | 'skipped') =>
    request(server)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status })
      .expect(200);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({
        now: () => new Date(now),
        today: () => dayOf(new Date(now)),
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
      email: 'challenge-other@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(async () => {
    // Thursday, 12 November 2026: the challenge counts from today.
    setNow('2026-11-12');
    await db.query(
      'TRUNCATE month_challenges, timers, habit_occurrences, habit_schedule_versions, habits CASCADE',
    );
  });
  afterAll(async () => {
    // Leaves no challenge behind for the suites after this one.
    await db.query('TRUNCATE month_challenges');
    await app.close();
  });

  it('needs a session', async () => {
    await anonymous(server).get('/month-challenges').expect(401);
    // From the app's own origin, so the origin check lets it through to
    // the session check.
    await anonymous(server)
      .post('/month-challenges')
      .set('Origin', process.env.FRONTEND_URL!)
      .send({})
      .expect(401);
  });

  it('starts on a Daily mid-month, counts strictly and shows in Heute and the Dailies', async () => {
    const sport = await daily('Sport');
    const created = await start({ habitId: sport.id, month: '2026-11' });
    expect(created).toMatchObject({
      month: '2026-11',
      startDate: '2026-11-12',
      endDate: '2026-11-30',
      habitId: sport.id,
      title: 'Sport',
      reminderTime: '19:00',
      status: 'running',
      endedAt: null,
      day: 1,
      days: 19,
      done: 0,
      missed: 0,
      remaining: 19,
      total: 19,
      percent: 0,
      todayRun: 'open',
    });
    expect(created.todayOccurrenceId).toEqual(expect.any(Number));

    // Heute carries the challenge and its marker; so do the Dailies.
    const today = (await request(server).get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(today.monthChallenge).toMatchObject({ id: created.id, day: 1 });
    expect(
      today.items.find(
        (item) => item.type === 'habit' && item.habitId === sport.id,
      ),
    ).toMatchObject({ monthChallenge: true });
    const reading = await daily('Lesen');
    const habits = (await request(server).get('/habits').expect(200))
      .body as HabitResponseDto[];
    expect(
      habits.map(({ title, monthChallenge }) => [title, monthChallenge]),
    ).toEqual([
      ['Sport', true],
      ['Lesen', false],
    ]);

    // One per month.
    const twice = await request(server)
      .post('/month-challenges')
      .send({ habitId: reading.id, month: '2026-11' })
      .expect(409);
    expect((twice.body as { message: string }).message).toBe(
      'Für November gibt es schon eine Monats-Challenge.',
    );

    // Done today: one of one, 18 still to come.
    await setRun(created.todayOccurrenceId!, 'completed');
    expect((await overview()).current).toMatchObject({
      done: 1,
      missed: 0,
      remaining: 18,
      todayRun: 'done',
      todayOccurrenceId: null,
    });

    // Friday: skipped by hand is missed, unlike the series.
    setNow('2026-11-13');
    const friday = (await overview()).current!;
    expect(friday).toMatchObject({ day: 2, todayRun: 'open' });
    await setRun(friday.todayOccurrenceId!, 'skipped');
    expect((await overview()).current).toMatchObject({
      done: 1,
      missed: 1,
      remaining: 17,
      todayRun: 'none',
    });
  });

  it('prepares next month, changes the reminder and freezes the month once over', async () => {
    const sport = await daily('Sport');
    const november = await start({
      habitId: sport.id,
      month: '2026-11',
      reminderTime: null,
    });
    expect(november.reminderTime).toBeNull();
    const reading = await daily('Lesen');
    const december = await start({ habitId: reading.id, month: '2026-12' });
    expect(december).toMatchObject({
      status: 'upcoming',
      startDate: '2026-12-01',
      days: 31,
      remaining: 31,
      todayRun: 'none',
    });
    await request(server)
      .post('/month-challenges')
      .send({ habitId: reading.id, month: '2027-01' })
      .expect(400);

    const changed = await request(server)
      .patch(`/month-challenges/${december.id}`)
      .send({ reminderTime: '07:30' })
      .expect(200);
    expect((changed.body as MonthChallengeResponse).reminderTime).toBe('07:30');
    await request(server)
      .patch(`/month-challenges/${december.id}`)
      .send({ reminderTime: '25:00' })
      .expect(400);

    let all = await overview();
    expect(all.current?.id).toBe(november.id);
    expect(all.next?.id).toBe(december.id);
    expect(all.past).toEqual([]);

    // Today's run done, the rest of November left open: 1 of 19.
    await setRun(november.todayOccurrenceId!, 'completed');
    setNow('2026-12-01');
    all = await overview();
    expect(all.current).toMatchObject({ id: december.id, status: 'running' });
    expect(all.next).toBeNull();
    expect(all.past).toEqual([
      expect.objectContaining({
        id: november.id,
        status: 'finished',
        done: 1,
        missed: 18,
        remaining: 0,
        total: 19,
        percent: 5,
        day: null,
      }),
    ]);
    expect(
      await db
        .getRepository(MonthChallengeEntity)
        .findOneByOrFail({ id: november.id }),
    ).toMatchObject({ doneCount: 1, dueCount: 19 });

    // A closed month no longer changes.
    await request(server)
      .patch(`/month-challenges/${november.id}`)
      .send({ reminderTime: '08:00' })
      .expect(409);
  });

  it('ends early, keeps a deleted Daily under its title and deletes', async () => {
    const sport = await daily('Sport');
    const challenge = await start({ habitId: sport.id, month: '2026-11' });
    await setRun(challenge.todayOccurrenceId!, 'completed');

    setNow('2026-11-14', 20 * 60);
    const ended = (
      await request(server)
        .post(`/month-challenges/${challenge.id}/end`)
        .expect(200)
    ).body as MonthChallengeResponse;
    // The 12th done, the 13th left open; today's open run counts neither way.
    expect(ended).toMatchObject({
      status: 'ended',
      done: 1,
      missed: 1,
      remaining: 0,
      total: 2,
    });
    expect(ended.endedAt).not.toBeNull();
    await request(server)
      .post(`/month-challenges/${challenge.id}/end`)
      .expect(409);

    // The Daily goes: the challenge stays with its title and result.
    await request(server).delete(`/habits/${sport.id}`).expect(204);
    const current = (await overview()).current!;
    expect(current).toMatchObject({
      habitId: null,
      title: 'Sport',
      status: 'ended',
      done: 1,
      total: 2,
    });

    await request(server)
      .delete(`/month-challenges/${challenge.id}`)
      .expect(204);
    expect((await overview()).current).toBeNull();
  });

  it('ends a running challenge when its Daily is deleted, and drops one not begun', async () => {
    const sport = await daily('Sport');
    const november = await start({ habitId: sport.id, month: '2026-11' });
    await start({ habitId: sport.id, month: '2026-12' });
    await setRun(november.todayOccurrenceId!, 'completed');

    await request(server).delete(`/habits/${sport.id}`).expect(204);
    const all = await overview();
    expect(all.current).toMatchObject({
      id: november.id,
      habitId: null,
      title: 'Sport',
      status: 'ended',
      done: 1,
      total: 1,
    });
    expect(all.next).toBeNull();
    const today = (await request(server).get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(today.monthChallenge).toBeNull();
  });

  it("refuses others' Dailies and paused ones, and keeps people apart", async () => {
    const paused = await daily('Pause');
    await request(server)
      .patch(`/habits/${paused.id}`)
      .send({ isActive: false })
      .expect(200);
    const refused = await request(server)
      .post('/month-challenges')
      .send({ habitId: paused.id, month: '2026-11' })
      .expect(400);
    expect((refused.body as { message: string }).message).toBe(
      'Ein pausiertes Daily kann keine Monats-Challenge tragen.',
    );
    await request(server)
      .post('/month-challenges')
      .send({ habitId: 999_999, month: '2026-11' })
      .expect(404);
    await request(server)
      .post('/month-challenges')
      .send({ habitId: paused.id, month: '2026-11', extra: true })
      .expect(400);

    const foreign = await db.getRepository(MonthChallengeEntity).save({
      userId: OTHER_USER,
      habitId: null,
      month: '2026-11-01',
      startDate: '2026-11-01',
      title: 'Fremd',
      reminderMinutes: null,
      remindedOn: null,
      doneCount: null,
      dueCount: null,
      endedAt: null,
    });
    expect((await overview()).current).toBeNull();
    await request(server)
      .patch(`/month-challenges/${foreign.id}`)
      .send({ reminderTime: '08:00' })
      .expect(404);
    await request(server).delete(`/month-challenges/${foreign.id}`).expect(204);
    expect(
      await db.getRepository(MonthChallengeEntity).existsBy({ id: foreign.id }),
    ).toBe(true);
  });
});
