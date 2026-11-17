import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';

type Item = {
  type: 'todo' | 'habit';
  title: string;
  todoId?: number;
  occurrenceId?: number;
  timeOfDay: string | null;
  campaign: { id: number; title: string } | null;
};

describe('Order of a day (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const today = dayOf(new Date());

  const todo = async (title: string, body: object = {}): Promise<number> =>
    (
      (
        await request(server)
          .post('/todos')
          .send({ title, scheduledDate: today, ...body })
          .expect(201)
      ).body as { id: number }
    ).id;
  const items = async (): Promise<Item[]> =>
    (
      (await request(server).get('/day-planner/today').expect(200)).body as {
        items: Item[];
      }
    ).items;
  const titles = async (): Promise<string[]> =>
    (await items()).map(({ title }) => title);
  const sort = (order: { type: 'todo' | 'habit'; id: number }[]) =>
    request(server).put('/day-planner/order').send({ items: order });

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

  it('keeps the sorted order and lets new items join at the end', async () => {
    const first = await todo('Erstes');
    const second = await todo('Zweites');
    const third = await todo('Drittes');
    expect(await titles()).toEqual(['Erstes', 'Zweites', 'Drittes']);

    await sort([
      { type: 'todo', id: third },
      { type: 'todo', id: first },
      { type: 'todo', id: second },
    ]).expect(204);
    expect(await titles()).toEqual(['Drittes', 'Erstes', 'Zweites']);

    await todo('Neu dazu');
    expect(await titles()).toEqual([
      'Drittes',
      'Erstes',
      'Zweites',
      'Neu dazu',
    ]);
  });

  it('sorts habits of the day together with todos', async () => {
    await request(server)
      .post('/habits')
      .send({
        title: 'Laufen',
        schedule: { type: 'interval', intervalDays: 1 },
      })
      .expect(201);
    const quest = await todo('Kapitel schreiben');
    const habit = (await items()).find((item) => item.type === 'habit')!;

    await sort([
      { type: 'todo', id: quest },
      { type: 'habit', id: habit.occurrenceId! },
    ]).expect(204);
    expect(await titles()).toEqual(['Kapitel schreiben', 'Laufen']);

    await sort([
      { type: 'habit', id: habit.occurrenceId! },
      { type: 'todo', id: quest },
    ]).expect(204);
    expect(await titles()).toEqual(['Laufen', 'Kapitel schreiben']);
  });

  it('keeps appointments on the clock, ahead of the open order', async () => {
    const open = await todo('Irgendwann');
    await todo('Zahnarzt', { timeOfDay: '14:00' });
    await todo('Standup', { timeOfDay: '09:30' });
    await sort([{ type: 'todo', id: open }]).expect(204);

    expect(
      (await items()).map(({ title, timeOfDay }) => [title, timeOfDay]),
    ).toEqual([
      ['Standup', '09:30'],
      ['Zahnarzt', '14:00'],
      ['Irgendwann', null],
    ]);
  });

  it('names the campaign an item works towards', async () => {
    const campaign = await todo('Buch schreiben', { scheduledDate: null });
    const series = await todo('Teil 1', {
      scheduledDate: null,
      parentId: campaign,
    });
    await todo('Kapitel 3', { parentId: series });
    await todo('Einkaufen');

    expect(
      (await items()).map(({ title, campaign: at }) => [title, at?.title]),
    ).toEqual([
      ['Kapitel 3', 'Buch schreiben'],
      ['Einkaufen', undefined],
    ]);
  });

  it('writes nothing unless every item is the own one', async () => {
    const own = await todo('Eigenes');
    const foreign = await db.getRepository(TodoEntity).save({
      userId: OTHER_USER,
      title: 'Fremdes',
      scheduledDate: today,
    });

    await sort([
      { type: 'todo', id: own },
      { type: 'todo', id: foreign.id },
    ]).expect(404);
    await sort([{ type: 'habit', id: 424242 }]).expect(404);

    const stored = await db.getRepository(TodoEntity).find();
    expect(stored.map(({ dayPosition }) => dayPosition)).toEqual([null, null]);
  });

  it('rejects malformed orders', async () => {
    await sort([{ type: 'timer' as 'todo', id: 1 }]).expect(400);
    await request(server).put('/day-planner/order').send({}).expect(400);
    await request(server)
      .put('/day-planner/order')
      .send({ items: [{ type: 'todo', id: 1, extra: true }] })
      .expect(400);
  });
});
