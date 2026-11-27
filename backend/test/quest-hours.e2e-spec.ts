import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import plainRequest from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { Clock } from '../src/common/clock';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import type { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import type { HistoryResponse } from '../src/history/history.dto';
import type { QuestHoursResponse } from '../src/quest-hours/quest-hours.dto';
import type { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { WorkLogEntity } from '../src/work-logs/work-log.entity';
import {
  authenticatedRequest as request,
  SEEDED_AUTH_TABLES,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { resetDatabase } from './reset-database';

const OTHER_USER = '55555555-5555-4555-8555-555555555555';
// A Wednesday; its week runs from Monday 16 to Sunday 22 November.
const NOW = new Date('2026-11-18T12:00:00.000Z');
const MONDAY = '2026-11-16';

describe('Quest hours (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;

  const todo = async (body: object): Promise<number> =>
    (
      (await request(server).post('/todos').send(body).expect(201)).body as {
        id: number;
      }
    ).id;
  /** A campaign: a top-level quest with one quest below it. */
  const campaign = async (
    title: string,
    style: object = {},
  ): Promise<{ id: number; quest: number }> => {
    const id = await todo({ title, ...style });
    return {
      id,
      quest: await todo({ title: `${title}: Schritt`, parentId: id }),
    };
  };
  const log = (
    target: { todoId: number } | { occurrenceId: number },
    from: string,
    to: string,
    userId = TEST_USER,
  ) =>
    db.getRepository(WorkLogEntity).save({
      userId,
      todoId: null,
      occurrenceId: null,
      ...target,
      title: 'Arbeit',
      startedAt: new Date(from),
      endedAt: new Date(to),
      source: 'manual' as const,
    });
  const week = async (start = MONDAY): Promise<QuestHoursResponse> =>
    (await request(server).get(`/quest-hours?week=${start}`).expect(200))
      .body as QuestHoursResponse;
  const getTodo = async (id: number): Promise<TodoResponseDto> =>
    (await request(server).get(`/todos/${id}`).expect(200))
      .body as TodoResponseDto;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ now: () => NOW, today: () => dayOf(NOW) })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);
    server = app.getHttpServer() as Server;
    db = app.get(DataSource);
    await db.getRepository(UserEntity).save({
      id: OTHER_USER,
      email: 'quest-hours@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(async () => {
    await resetDatabase(db, { keep: SEEDED_AUTH_TABLES });
  });
  afterAll(() => app.close());

  it('requires authentication', async () => {
    await plainRequest(server).get(`/quest-hours?week=${MONDAY}`).expect(401);
    await plainRequest(server).get('/quest-hours/target').expect(401);
    await plainRequest(server)
      .put('/quest-hours/target')
      .set('Origin', process.env.FRONTEND_URL!)
      .send({ weeklyTargetMinutes: 60 })
      .expect(401);
  });

  it.each([
    '',
    'week=',
    'week=2026-11-17',
    'week=2026-02-30',
    'week=16.11.2026',
    `week=${MONDAY}&extra=1`,
  ])('rejects the query %p', async (query) => {
    await request(server).get(`/quest-hours?${query}`).expect(400);
  });

  it('counts time on campaign quests per day, per campaign and against the goals', async () => {
    const book = await campaign('Buch', {
      color: 'berry',
      icon: 'book',
      weeklyTargetMinutes: 360,
    });
    const garden = await campaign('Garten', { weeklyTargetMinutes: 120 });
    const loose = await todo({ title: 'Einkaufen' });
    await request(server)
      .put('/quest-hours/target')
      .send({ weeklyTargetMinutes: 1200 })
      .expect(200);

    // Monday: 90 minutes on the book, 30 on a quest without campaign.
    await log(
      { todoId: book.quest },
      '2026-11-16T08:00:00Z',
      '2026-11-16T09:30:00Z',
    );
    await log(
      { todoId: loose },
      '2026-11-16T10:00:00Z',
      '2026-11-16T10:30:00Z',
    );
    // Wednesday: the campaign itself, and an overlapping stretch that counts once.
    await log(
      { todoId: book.id },
      '2026-11-18T08:00:00Z',
      '2026-11-18T09:00:00Z',
    );
    await log(
      { todoId: book.quest },
      '2026-11-18T08:30:00Z',
      '2026-11-18T09:15:00Z',
    );
    // The week before, and the Sunday night that runs into this week.
    await log(
      { todoId: book.quest },
      '2026-11-10T08:00:00Z',
      '2026-11-10T09:00:00Z',
    );
    await log(
      { todoId: book.quest },
      '2026-11-15T22:30:00Z',
      '2026-11-15T23:30:00Z',
    );

    const body = await week();
    expect(body).toMatchObject({
      startDate: MONDAY,
      endDate: '2026-11-22',
      today: '2026-11-18',
      weeklyTargetMinutes: 1200,
      // 30 minutes after Berlin midnight + 90 on Monday + 75 on Wednesday.
      questMinutes: 195,
      otherMinutes: 30,
    });
    expect(body.days.slice(0, 3)).toEqual([
      { date: MONDAY, questMinutes: 120, otherMinutes: 30 },
      { date: '2026-11-17', questMinutes: 0, otherMinutes: 0 },
      { date: '2026-11-18', questMinutes: 75, otherMinutes: 0 },
    ]);
    expect(body.weeks.slice(-2)).toEqual([
      { startDate: '2026-11-09', questMinutes: 90, otherMinutes: 0 },
      { startDate: MONDAY, questMinutes: 195, otherMinutes: 30 },
    ]);
    expect(body.campaigns).toEqual([
      {
        campaign: { id: book.id, title: 'Buch', color: 'berry', icon: 'book' },
        minutes: 195,
        weeklyTargetMinutes: 360,
        weeks: [0, 0, 0, 0, 0, 0, 90, 195],
        totalMinutes: 285,
      },
      {
        campaign: { id: garden.id, title: 'Garten', color: null, icon: null },
        minutes: 0,
        weeklyTargetMinutes: 120,
        weeks: [0, 0, 0, 0, 0, 0, 0, 0],
        totalMinutes: 0,
      },
    ]);
  });

  it('counts a daily for the campaign of the goal counting it', async () => {
    const book = await campaign('Buch');
    const habitId = (
      (
        await request(server)
          .post('/habits')
          .send({
            title: 'Schreiben',
            schedule: { type: 'interval', intervalDays: 1 },
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    await request(server)
      .patch(`/todos/${book.quest}`)
      .send({
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        goalHabitId: habitId,
        goalTarget: 20,
      })
      .expect(200);
    const due = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const [run] = due.body as { id: number }[];
    await log(
      { occurrenceId: run.id },
      '2026-11-18T06:00:00Z',
      '2026-11-18T06:40:00Z',
    );

    const body = await week();
    expect(body.questMinutes).toBe(40);
    expect(
      body.campaigns.map(({ campaign, minutes }) => [campaign.id, minutes]),
    ).toEqual([[book.id, 40]]);
  });

  it('never shows or changes another user’s campaigns, time or goal', async () => {
    const own = await campaign('Eigenes');
    const foreign = await db.getRepository(TodoEntity).save({
      userId: OTHER_USER,
      title: 'Fremde Kampagne',
      weeklyTargetMinutes: 600,
      color: 'moss',
    });
    const foreignChild = await db.getRepository(TodoEntity).save({
      userId: OTHER_USER,
      title: 'Fremde Quest',
      parentId: foreign.id,
    });
    await db.query(
      `INSERT INTO weekly_quest_targets ("userId", "validFrom", minutes)
       VALUES ($1, '2026-11-02', 3000)`,
      [OTHER_USER],
    );
    await log(
      { todoId: own.quest },
      '2026-11-17T08:00:00Z',
      '2026-11-17T08:30:00Z',
    );
    await log(
      { todoId: foreignChild.id },
      '2026-11-17T08:00:00Z',
      '2026-11-17T12:00:00Z',
      OTHER_USER,
    );

    const body = await week();
    expect(body.weeklyTargetMinutes).toBeNull();
    expect(body.questMinutes).toBe(30);
    expect(body.otherMinutes).toBe(0);
    expect(body.campaigns.map(({ campaign }) => campaign.id)).toEqual([own.id]);
    expect(
      (await request(server).get('/quest-hours/target').expect(200)).body,
    ).toEqual({ weeklyTargetMinutes: null });

    await request(server)
      .patch(`/todos/${foreign.id}`)
      .send({ color: 'berry', weeklyTargetMinutes: 60 })
      .expect(404);
    await request(server)
      .put('/quest-hours/target')
      .send({ weeklyTargetMinutes: 90 })
      .expect(200);
    expect(
      await db.getRepository(TodoEntity).findOneByOrFail({ id: foreign.id }),
    ).toMatchObject({ color: 'moss', weeklyTargetMinutes: 600 });
    expect(
      await db.query(
        `SELECT "userId", "validFrom"::text AS "validFrom", minutes
         FROM weekly_quest_targets ORDER BY minutes`,
      ),
    ).toEqual([
      { userId: TEST_USER, validFrom: MONDAY, minutes: 90 },
      { userId: OTHER_USER, validFrom: '2026-11-02', minutes: 3000 },
    ]);
  });

  it('keeps the goal each week had: a change holds from the running week on', async () => {
    // A goal set long ago, then changed today (a Wednesday).
    await db.query(
      `INSERT INTO weekly_quest_targets ("userId", "validFrom", minutes)
       VALUES ($1, '2026-10-26', 600)`,
      [TEST_USER],
    );
    expect(
      (
        await request(server)
          .put('/quest-hours/target')
          .send({ weeklyTargetMinutes: 1200 })
          .expect(200)
      ).body,
    ).toEqual({ weeklyTargetMinutes: 1200 });

    expect((await week('2026-10-19')).weeklyTargetMinutes).toBeNull();
    expect((await week('2026-11-09')).weeklyTargetMinutes).toBe(600);
    expect((await week(MONDAY)).weeklyTargetMinutes).toBe(1200);
    expect((await week('2026-11-30')).weeklyTargetMinutes).toBe(1200);
    expect(
      (await request(server).get('/quest-hours/target').expect(200)).body,
    ).toEqual({ weeklyTargetMinutes: 1200 });
    const today = (await request(server).get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(today.questHours.weeklyTargetMinutes).toBe(1200);

    // Changed twice in a week, the week keeps one row; removing it holds too.
    await request(server)
      .put('/quest-hours/target')
      .send({ weeklyTargetMinutes: null })
      .expect(200);
    expect((await week(MONDAY)).weeklyTargetMinutes).toBeNull();
    expect((await week('2026-11-09')).weeklyTargetMinutes).toBe(600);
    // Back to what the weeks before had: no row of its own is needed.
    await request(server)
      .put('/quest-hours/target')
      .send({ weeklyTargetMinutes: 600 })
      .expect(200);
    expect(
      await db.query(
        `SELECT "validFrom"::text AS "validFrom", minutes
         FROM weekly_quest_targets WHERE "userId" = $1`,
        [TEST_USER],
      ),
    ).toEqual([{ validFrom: '2026-10-26', minutes: 600 }]);
  });

  describe('campaign goal, colour and icon', () => {
    it('stores them on a campaign and names it with them everywhere', async () => {
      const book = await campaign('Buch');
      const patched = await request(server)
        .patch(`/todos/${book.id}`)
        .send({ color: 'pine', icon: 'leaf', weeklyTargetMinutes: 6000 })
        .expect(200);
      expect(patched.body).toMatchObject({
        color: 'pine',
        icon: 'leaf',
        weeklyTargetMinutes: 6000,
      });
      await request(server)
        .patch(`/todos/${book.quest}`)
        .send({ scheduledDate: '2026-11-18' })
        .expect(200);
      await log(
        { todoId: book.quest },
        '2026-11-18T08:00:00Z',
        '2026-11-18T08:20:00Z',
      );
      const named = { id: book.id, title: 'Buch', color: 'pine', icon: 'leaf' };

      const today = (
        await request(server).get('/day-planner/today').expect(200)
      ).body as DayPlannerResponseDto;
      expect(today.items[0].campaign).toEqual(named);
      const history = (
        await request(server)
          .get('/history?date=2026-11-18&view=day')
          .expect(200)
      ).body as HistoryResponse;
      expect(history.days[0].work.logs?.[0].campaign).toEqual(named);
      expect(history.days[0].work.campaigns?.[0].campaign).toEqual(named);

      const cleared = await request(server)
        .patch(`/todos/${book.id}`)
        .send({ color: null, icon: null, weeklyTargetMinutes: null })
        .expect(200);
      expect(cleared.body).toMatchObject({
        color: null,
        icon: null,
        weeklyTargetMinutes: null,
      });
    });

    it.each([
      { color: 'orange' },
      { icon: 'rocket' },
      { weeklyTargetMinutes: 0 },
      { weeklyTargetMinutes: 6001 },
      { weeklyTargetMinutes: 90.5 },
      { weeklyTargetMinutes: '120' },
    ])('rejects %p', async (body) => {
      const { id } = await campaign('Buch');
      await request(server).patch(`/todos/${id}`).send(body).expect(400);
      await request(server)
        .post('/todos')
        .send({ title: 'Neu', ...body })
        .expect(400);
    });

    it('only lets a todo without parent carry them', async () => {
      const book = await campaign('Buch');
      for (const body of [
        { color: 'moss' },
        { icon: 'flag' },
        { weeklyTargetMinutes: 60 },
      ]) {
        await request(server)
          .patch(`/todos/${book.quest}`)
          .send(body)
          .expect(400);
        await request(server)
          .post('/todos')
          .send({ title: 'Darunter', parentId: book.id, ...body })
          .expect(400);
      }
      // Emptying them is fine anywhere.
      await request(server)
        .patch(`/todos/${book.quest}`)
        .send({ color: null })
        .expect(200);
      // The database holds the rule too.
      await expect(
        db.query('UPDATE todos SET color = $1 WHERE id = $2', [
          'moss',
          book.quest,
        ]),
      ).rejects.toThrow(/CHK_todos_campaign_fields/);
    });

    it('clears them when the campaign moves below another todo', async () => {
      const book = await campaign('Buch', {
        color: 'slate',
        icon: 'pen',
        weeklyTargetMinutes: 240,
      });
      const other = await todo({ title: 'Lebensziele' });
      await request(server)
        .patch(`/todos/${book.id}`)
        .send({ parentId: other })
        .expect(200);
      expect(await getTodo(book.id)).toMatchObject({
        parentId: other,
        color: null,
        icon: null,
        weeklyTargetMinutes: null,
      });
      await request(server)
        .patch(`/todos/${book.id}`)
        .send({ parentId: null, color: 'slate' })
        .expect(200);
      expect(await getTodo(book.id)).toMatchObject({
        parentId: null,
        color: 'slate',
      });
    });
  });

  describe('overall weekly goal', () => {
    it('is read and written in minutes, and removed with null', async () => {
      const target = () =>
        request(server).get('/quest-hours/target').expect(200);
      expect((await target()).body).toEqual({ weeklyTargetMinutes: null });
      const set = await request(server)
        .put('/quest-hours/target')
        .send({ weeklyTargetMinutes: 1230 })
        .expect(200);
      expect(set.body).toEqual({ weeklyTargetMinutes: 1230 });
      expect((await target()).body).toEqual({ weeklyTargetMinutes: 1230 });
      await request(server)
        .put('/quest-hours/target')
        .send({ weeklyTargetMinutes: null })
        .expect(200);
      expect((await target()).body).toEqual({ weeklyTargetMinutes: null });
    });

    it.each([
      {},
      { weeklyTargetMinutes: 0 },
      { weeklyTargetMinutes: 6001 },
      { weeklyTargetMinutes: 60.5 },
      { weeklyTargetMinutes: '600' },
      { weeklyTargetMinutes: 600, extra: true },
    ])('rejects %p', async (body) => {
      await request(server).put('/quest-hours/target').send(body).expect(400);
    });
  });

  it('gives Heute the quest minutes of today and the week with the goal', async () => {
    const before = (await request(server).get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(before.questHours).toEqual({
      todayMinutes: 0,
      weekMinutes: 0,
      weeklyTargetMinutes: null,
    });

    const book = await campaign('Buch');
    const loose = await todo({ title: 'Einkaufen' });
    await request(server)
      .put('/quest-hours/target')
      .send({ weeklyTargetMinutes: 600 })
      .expect(200);
    await log(
      { todoId: book.quest },
      '2026-11-16T08:00:00Z',
      '2026-11-16T09:00:00Z',
    );
    await log(
      { todoId: book.quest },
      '2026-11-18T08:00:00Z',
      '2026-11-18T08:25:00Z',
    );
    await log(
      { todoId: loose },
      '2026-11-18T09:00:00Z',
      '2026-11-18T09:30:00Z',
    );
    // Next Monday is another week.
    await log(
      { todoId: book.quest },
      '2026-11-23T08:00:00Z',
      '2026-11-23T09:00:00Z',
    );

    const after = (await request(server).get('/day-planner/today').expect(200))
      .body as DayPlannerResponseDto;
    expect(after.questHours).toEqual({
      todayMinutes: 25,
      weekMinutes: 85,
      weeklyTargetMinutes: 600,
    });
    expect(after.workedMinutes).toBe(55);
    // The same numbers as the week read.
    const body = await week();
    expect(body.questMinutes).toBe(after.questHours.weekMinutes);
    expect(body.days[2].questMinutes).toBe(after.questHours.todayMinutes);
  });
});
