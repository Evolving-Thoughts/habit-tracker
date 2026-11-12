import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { addDays, dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../src/habit-occurrences/enums/habit-occurrence-status.enum';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

type Node = {
  id: number;
  habitGoal: { completed: number; reached: boolean } | null;
  progress: { percentage: number };
};

describe('Habit goals on todos (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());
  const period = {
    periodStart: addDays(today, -10),
    periodEnd: addDays(today, 10),
  };
  const habit = async (): Promise<number> =>
    (
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
  const todo = async (): Promise<number> =>
    (
      (await request(server).post('/todos').send({ title: 'Ziel' }).expect(201))
        .body as { id: number }
    ).id;
  const setGoal = (id: number, body: object) =>
    request(server).patch(`/todos/${id}`).send(body);
  const goalOf = async (id: number) => {
    const tree = await request(server).get('/todos/hierarchy').expect(200);
    return (tree.body as Node[]).find((node) => node.id === id)!;
  };

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
      'TRUNCATE work_logs, timers, habit_occurrences, habit_schedule_versions, habits, todos CASCADE',
    ),
  );
  afterAll(() => app.close());

  it('counts completions in the period, live and reversibly', async () => {
    const habitId = await habit();
    const id = await todo();
    await setGoal(id, {
      ...period,
      goalHabitId: habitId,
      goalTarget: 1,
    }).expect(200);
    expect((await goalOf(id)).habitGoal).toMatchObject({
      completed: 0,
      reached: false,
    });

    const due = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);
    const occurrence = (due.body as { id: number }[])[0];
    const change = (status: HabitOccurrenceStatus) =>
      request(server)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({ status })
        .expect(200);

    await change(HabitOccurrenceStatus.COMPLETED);
    expect((await goalOf(id)).habitGoal).toMatchObject({
      completed: 1,
      reached: true,
    });

    await change(HabitOccurrenceStatus.PENDING);
    expect((await goalOf(id)).habitGoal).toMatchObject({ completed: 0 });
  });

  it('ignores completions outside the period and leaves subtree progress alone', async () => {
    const habitId = await habit();
    const id = await todo();
    await setGoal(id, {
      ...period,
      goalHabitId: habitId,
      goalTarget: 5,
    }).expect(200);
    await request(server).get('/habit-occurrences/today').expect(200);
    const repository = db.getRepository(HabitOccurrenceEntity);
    const { scheduleVersionId } = await repository.findOneByOrFail({ habitId });
    await repository.save({
      habitId,
      scheduleVersionId,
      scheduledDate: addDays(today, -30),
      status: HabitOccurrenceStatus.COMPLETED,
      resolvedDate: addDays(today, -30),
    });
    const node = await goalOf(id);
    expect(node.habitGoal).toMatchObject({ completed: 0 });
    expect(node.progress.percentage).toBe(0);
  });

  it('shows the why and the goal of an item in the day planner', async () => {
    const habitId = await habit();
    await request(server)
      .patch(`/habits/${habitId}`)
      .send({ why: 'Halbmarathon im März' })
      .expect(200);
    const id = await todo();
    await setGoal(id, {
      ...period,
      goalHabitId: habitId,
      goalTarget: 20,
    }).expect(200);
    await request(server)
      .post('/todos')
      .send({
        title: 'Schuhe kaufen',
        parentId: id,
        why: 'Ohne Blasen laufen',
        scheduledAt: new Date().toISOString(),
      })
      .expect(201);

    const day = await request(server).get('/day-planner/today').expect(200);
    const items = (
      day.body as {
        items: { title: string; why: string | null; goal: object | null }[];
        workedMinutes: number;
      }
    ).items;
    expect(items.find((item) => item.title === 'Laufen')).toMatchObject({
      why: 'Halbmarathon im März',
      goal: {
        title: 'Ziel',
        completed: 0,
        target: 20,
        periodEnd: period.periodEnd,
      },
      workedMinutes: 0,
    });
    expect(items.find((item) => item.title === 'Schuhe kaufen')).toMatchObject({
      why: 'Ohne Blasen laufen',
      goal: { title: 'Ziel', completed: null, target: null },
    });
    expect((day.body as { workedMinutes: number }).workedMinutes).toBe(0);
  });

  it('refuses a second goal for the same habit in an overlapping period', async () => {
    const habitId = await habit();
    const goal = { ...period, goalHabitId: habitId, goalTarget: 3 };
    await setGoal(await todo(), goal).expect(200);
    const second = await todo();
    await setGoal(second, goal).expect(409);
    await setGoal(second, {
      ...goal,
      periodStart: addDays(today, 11),
      periodEnd: addDays(today, 20),
    }).expect(200);
  });

  it('allows a plain period and rejects incomplete goals', async () => {
    const habitId = await habit();
    const id = await todo();
    await setGoal(id, period).expect(200);
    await setGoal(id, { periodStart: null }).expect(400);
    await setGoal(id, {
      periodStart: period.periodEnd,
      periodEnd: period.periodStart,
    }).expect(400);
    await setGoal(id, { goalHabitId: habitId }).expect(400);
    const plain = await todo();
    await setGoal(plain, { goalHabitId: habitId, goalTarget: 2 }).expect(400);
    await setGoal(id, { goalHabitId: 424242, goalTarget: 2 }).expect(400);
  });
});
