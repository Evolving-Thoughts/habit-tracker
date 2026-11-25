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
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { GoalSnapshotEntity } from '../src/todos/goal-snapshot.entity';
import type { WeekReviewResponse } from '../src/week-review/week-review.dto';
import { WeekReviewEntity } from '../src/week-review/week-review.entity';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';

const OTHER_USER = '66666666-6666-4666-8666-666666666666';
// A Wednesday; its week runs from Monday 16 to Sunday 22 November.
const NOW = new Date('2026-11-18T12:00:00.000Z');
const MONDAY = '2026-11-16';
const LAST_MONDAY = '2026-11-09';
const NO_ANSWERS = { wentWell: null, wentBadly: null, changeNext: null };

describe('Week review (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;

  const todo = async (body: object): Promise<number> =>
    (
      (await request(server).post('/todos').send(body).expect(201)).body as {
        id: number;
      }
    ).id;
  /** Moves a todo's creation and completion to fixed moments. */
  const backdate = (
    id: number,
    createdAt: string,
    completedAt: string | null = null,
  ) =>
    db.getRepository(TodoEntity).update(id, {
      createdAt: new Date(createdAt),
      completed: completedAt !== null,
      completedAt: completedAt ? new Date(completedAt) : null,
    });
  const review = async (week = MONDAY): Promise<WeekReviewResponse> =>
    (await request(server).get(`/week-review?week=${week}`).expect(200))
      .body as WeekReviewResponse;
  const save = (week: string, body: object) =>
    request(server).put(`/week-review/${week}`).send(body);

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
      email: 'week-review@example.test',
      passwordHash: 'x',
      verifiedAt: new Date(),
    });
  });
  beforeEach(() =>
    db.query(
      'TRUNCATE week_reviews, goal_snapshots, work_logs, timers, habit_occurrences, habit_schedule_versions, habits, todos, categories CASCADE',
    ),
  );
  afterAll(() => app.close());

  it('requires authentication', async () => {
    await plainRequest(server).get(`/week-review?week=${MONDAY}`).expect(401);
    await plainRequest(server)
      .put(`/week-review/${MONDAY}`)
      .set('Origin', process.env.FRONTEND_URL!)
      .send({ wentWell: 'x' })
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
    await request(server).get(`/week-review?${query}`).expect(400);
  });

  it('reads an empty week calmly', async () => {
    expect(await review()).toEqual({
      startDate: MONDAY,
      endDate: '2026-11-22',
      today: '2026-11-18',
      campaigns: [],
      weekQuota: null,
      perfectWeek: null,
      monthChallenge: null,
      days: [16, 17, 18, 19, 20, 21, 22].map((day) => ({
        date: `2026-11-${day}`,
        items: [],
      })),
      answers: NO_ANSWERS,
    });
  });

  it('stores, replaces and clears the answers of a week', async () => {
    expect(
      (
        await save(MONDAY, {
          wentWell: ' Drei Kapitel ',
          wentBadly: '',
          changeNext: 'Früher anfangen',
        }).expect(200)
      ).body,
    ).toEqual({
      wentWell: 'Drei Kapitel',
      wentBadly: null,
      changeNext: 'Früher anfangen',
    });
    expect((await review()).answers).toEqual({
      wentWell: 'Drei Kapitel',
      wentBadly: null,
      changeNext: 'Früher anfangen',
    });

    // A save replaces all three answers.
    await save(MONDAY, { wentBadly: 'Zu wenig Schlaf' }).expect(200);
    expect((await review()).answers).toEqual({
      ...NO_ANSWERS,
      wentBadly: 'Zu wenig Schlaf',
    });
    expect(await db.getRepository(WeekReviewEntity).count()).toBe(1);

    // All empty: nothing to keep.
    expect(
      (
        await save(MONDAY, {
          wentWell: ' ',
          wentBadly: null,
          changeNext: '',
        }).expect(200)
      ).body,
    ).toEqual(NO_ANSWERS);
    expect(await db.getRepository(WeekReviewEntity).count()).toBe(0);
    expect((await review()).answers).toEqual(NO_ANSWERS);

    // Past weeks are fine; weeks keep their answers apart.
    await save(LAST_MONDAY, { wentWell: 'Urlaub' }).expect(200);
    expect((await review(LAST_MONDAY)).answers.wentWell).toBe('Urlaub');
    expect((await review()).answers).toEqual(NO_ANSWERS);
  });

  it.each([
    ['a Tuesday', '2026-11-17', { wentWell: 'x' }],
    ['no date', 'bald', { wentWell: 'x' }],
    ['a week still ahead', '2026-11-23', { wentWell: 'x' }],
    ['a long answer', MONDAY, { wentWell: 'x'.repeat(10001) }],
    ['a number', MONDAY, { wentWell: 5 }],
    ['an unknown field', MONDAY, { mood: 'gut' }],
  ])('rejects saving %s', async (_case, week, body) => {
    await save(week, body).expect(400);
    expect(await db.getRepository(WeekReviewEntity).count()).toBe(0);
  });

  it("keeps another user's review apart", async () => {
    await db
      .getRepository(WeekReviewEntity)
      .save({ userId: OTHER_USER, week: MONDAY, wentWell: 'Geheim' });
    expect((await review()).answers).toEqual(NO_ANSWERS);
    await save(MONDAY, { wentWell: 'Meins' }).expect(200);
    expect(await db.getRepository(WeekReviewEntity).count()).toBe(2);
    expect(
      await db
        .getRepository(WeekReviewEntity)
        .findOneByOrFail({ userId: OTHER_USER }),
    ).toMatchObject({ wentWell: 'Geheim' });
  });

  it('shows where each active campaign stood at the start and at the end', async () => {
    const book = await todo({ title: 'Buch', color: 'berry', icon: 'book' });
    const quests = [
      await todo({ title: 'Gliederung', parentId: book }),
      await todo({ title: 'Kapitel 1', parentId: book }),
      await todo({ title: 'Kapitel 2', parentId: book }),
      await todo({ title: 'Kapitel 3', parentId: book }),
    ];
    await backdate(book, '2026-11-01T10:00:00Z');
    await backdate(quests[0], '2026-11-01T10:00:00Z', '2026-11-11T10:00:00Z');
    await backdate(quests[1], '2026-11-01T10:00:00Z', '2026-11-17T10:00:00Z');
    await backdate(quests[2], '2026-11-01T10:00:00Z');
    await backdate(quests[3], '2026-11-01T10:00:00Z');
    // The state stored on Saturday of the week before.
    await db.getRepository(GoalSnapshotEntity).save({
      userId: TEST_USER,
      rootTodoId: book,
      date: '2026-11-14',
      doneCount: 1,
      totalCount: 4,
      doneMinutes: 0,
      totalMinutes: 0,
    });
    // Neither of these is reviewed: one finished before, one is a lone quest.
    const old = await todo({ title: 'Umzug' });
    await todo({ title: 'Kisten', parentId: old });
    await backdate(old, '2026-10-01T10:00:00Z', '2026-11-01T10:00:00Z');
    await todo({ title: 'Einkaufen' });

    expect((await review()).campaigns).toEqual([
      {
        campaign: { id: book, title: 'Buch', color: 'berry', icon: 'book' },
        start: {
          doneCount: 1,
          totalCount: 4,
          percentage: 25,
          source: 'snapshot',
        },
        end: { doneCount: 2, totalCount: 4, percentage: 50, source: 'live' },
        dailyGoals: [],
      },
    ]);
    // The week before has no snapshot before it: read back from the todos.
    expect((await review(LAST_MONDAY)).campaigns).toEqual([
      expect.objectContaining({
        start: {
          doneCount: 0,
          totalCount: 4,
          percentage: 0,
          source: 'reconstructed',
        },
        end: {
          doneCount: 1,
          totalCount: 4,
          percentage: 25,

          source: 'snapshot',
        },
      }),
    ]);
    // Before the book existed, only the move was still under way.
    expect(
      (await review('2026-10-19')).campaigns.map(({ campaign }) => campaign.id),
    ).toEqual([old]);
  });

  it('lists what was done, the quota, the perfect week and daily goals', async () => {
    const category = (
      (
        await request(server)
          .post('/categories')
          .send({ name: 'Schreiben' })
          .expect(201)
      ).body as { id: number }
    ).id;
    await request(server)
      .patch(`/categories/${category}`)
      .send({ weeklyTarget: 2 })
      .expect(200);
    const book = await todo({ title: 'Buch' });
    const chapter = await todo({
      title: 'Kapitel',
      parentId: book,
      categoryId: category,
    });
    const habitId = (
      (
        await request(server)
          .post('/habits')
          .send({
            title: 'Schreiben am Morgen',
            categoryId: category,
            schedule: { type: 'interval', intervalDays: 1 },
          })
          .expect(201)
      ).body as { id: number }
    ).id;
    await request(server)
      .patch(`/todos/${book}`)
      .send({
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        goalHabitId: habitId,
        goalTarget: 20,
      })
      .expect(200);
    await backdate(book, '2026-11-01T10:00:00Z');
    await request(server)
      .patch(`/todos/${chapter}`)
      .send({ completed: true })
      .expect(200);
    const due = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const [run] = due.body as { id: number }[];
    await request(server)
      .patch(`/habit-occurrences/${run.id}/status`)
      .send({ status: 'completed' })
      .expect(200);

    const body = await review();
    const campaign = { id: book, title: 'Buch', color: null, icon: null };
    expect(body.days[2].date).toBe('2026-11-18');
    expect(
      body.days[2].items
        .map(({ type, id, title, status, deleted, campaign: of }) => ({
          type,
          id,
          title,
          status,
          deleted,
          campaign: of,
        }))
        .sort((a, b) => a.type.localeCompare(b.type)),
    ).toEqual([
      {
        type: 'habit',
        id: run.id,
        title: 'Schreiben am Morgen',
        status: 'completed',
        deleted: false,
        campaign,
      },
      {
        type: 'todo',
        id: chapter,
        title: 'Kapitel',
        status: 'completed',
        deleted: false,
        campaign,
      },
    ]);
    expect(body.weekQuota).toEqual({ completed: 1, total: 1, percentage: 100 });
    expect(body.perfectWeek).toEqual({
      perfect: true,
      categories: [
        {
          id: category,
          name: 'Schreiben',
          color: 'indigo', // the first free core colour, given when it was created
          target: 2,
          completed: 2,
          reached: true,
        },
      ],
    });
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0].dailyGoals).toEqual([
      {
        todoId: book,
        habitId,
        habitTitle: 'Schreiben am Morgen',
        target: 20,
        before: 0,
        after: 1,
      },
    ]);
  });

  it('writes nothing when read', async () => {
    const book = await todo({ title: 'Buch' });
    await todo({ title: 'Kapitel', parentId: book });
    await review();
    expect(await db.getRepository(GoalSnapshotEntity).count()).toBe(0);
    expect(await db.getRepository(WeekReviewEntity).count()).toBe(0);
  });
});
