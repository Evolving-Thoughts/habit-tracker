import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { CategoryEntity } from '../src/categories/category.entity';
import { dayOf } from '../src/common/date/local-day';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';

const OTHER_USER = '22222222-2222-4222-8222-222222222222';
type Named = { id: number; name: string };
type Todo = { id: number; categoryId: number | null; why: string | null };

describe('Categories and why (e2e)', () => {
  let app: INestApplication, server: Server, db: DataSource;
  const category = async (name: string): Promise<Named> =>
    (await request(server).post('/categories').send({ name }).expect(201))
      .body as Named;
  const todo = async (body: object): Promise<Todo> =>
    (
      await request(server)
        .post('/todos')
        .send({ title: 'Üben', ...body })
        .expect(201)
    ).body as Todo;

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
  beforeEach(() => db.query('TRUNCATE categories CASCADE'));
  afterAll(() => app.close());

  it('creates, lists and renames, refusing duplicate names', async () => {
    const created = await category('  Gitarre ');
    expect(created.name).toBe('Gitarre');
    await request(server)
      .post('/categories')
      .send({ name: 'gitarre' })
      .expect(409);
    await request(server)
      .patch(`/categories/${created.id}`)
      .send({ name: 'Musik' })
      .expect(200);
    const list = await request(server).get('/categories').expect(200);
    // Without a chosen colour it got the first free core colour, stored.
    expect(list.body).toEqual([
      {
        id: created.id,
        name: 'Musik',
        weeklyTarget: null,
        color: 'indigo',
        colorChosen: true,
      },
    ]);
  });

  it('gives each new category the first colour of the pick order no other one shows', async () => {
    // "Haushalt" and "Kreativ" would pick the same colour from their names.
    const first = await category('Haushalt');
    const second = await category('Kreativ');
    const list = (await request(server).get('/categories').expect(200))
      .body as (Named & { color: string })[];
    expect(list.map(({ id, color }) => [id, color])).toEqual([
      [first.id, 'indigo'],
      [second.id, 'ochre'],
    ]);
  });

  it('shows older categories without a stored colour apart from each other', async () => {
    // Stored before colours were assigned: both names pick the same one.
    const [home, art] = await db.getRepository(CategoryEntity).save([
      { userId: TEST_USER, name: 'Haushalt', color: null },
      { userId: TEST_USER, name: 'Kreativ', color: null },
    ]);
    await request(server)
      .post('/todos')
      .send({
        title: 'Putzen',
        categoryId: art.id,
        scheduledDate: dayOf(new Date()),
      })
      .expect(201);
    const list = (await request(server).get('/categories').expect(200))
      .body as (Named & { color: string; colorChosen: boolean })[];
    expect(list).toEqual([
      expect.objectContaining({
        id: home.id,
        color: 'pine',
        colorChosen: false,
      }),
      expect.objectContaining({
        id: art.id,
        color: 'indigo',
        colorChosen: false,
      }),
    ]);
    // Entries show the same colour as the settings.
    const planner = await request(server).get('/day-planner/today').expect(200);
    expect((planner.body as { items: unknown[] }).items[0]).toMatchObject({
      categoryName: 'Kreativ',
      categoryColor: 'indigo',
    });
  });

  it('keeps a chosen colour, refusing one outside the palette', async () => {
    const created = (
      await request(server)
        .post('/categories')
        .send({ name: 'Lesen', color: 'navy' })
        .expect(201)
    ).body as Named & { color: string | null };
    expect(created.color).toBe('navy');
    await request(server)
      .patch(`/categories/${created.id}`)
      .send({ color: 'orange' })
      .expect(400);
    const reset = await request(server)
      .patch(`/categories/${created.id}`)
      .send({ color: null })
      .expect(200);
    // Back to "Automatisch": it shows a colour, but none is stored.
    expect(reset.body).toMatchObject({
      name: 'Lesen',
      color: 'indigo',
      colorChosen: false,
    });
  });

  it('stores category and why on todos and habits', async () => {
    const { id } = await category('Sport');
    const created = await todo({ categoryId: id, why: '  Fit bleiben ' });
    expect(created).toMatchObject({ categoryId: id, why: 'Fit bleiben' });
    const updated = await request(server)
      .patch(`/todos/${created.id}`)
      .send({ categoryId: null, why: '   ' })
      .expect(200);
    expect(updated.body).toMatchObject({ categoryId: null, why: null });

    const habit = await request(server)
      .post('/habits')
      .send({
        title: 'Joggen',
        categoryId: id,
        why: 'Ausdauer',
        schedule: { type: 'interval', intervalDays: 2 },
      })
      .expect(201);
    expect(habit.body).toMatchObject({ categoryId: id, why: 'Ausdauer' });
  });

  it('prefills a new child once, without live inheritance', async () => {
    const sport = await category('Sport');
    const music = await category('Musik');
    const parent = await todo({ categoryId: sport.id });
    const child = await todo({ parentId: parent.id });
    expect(child.categoryId).toBe(sport.id);
    const own = await todo({ parentId: parent.id, categoryId: null });
    expect(own.categoryId).toBeNull();

    await request(server)
      .patch(`/todos/${parent.id}`)
      .send({ categoryId: music.id })
      .expect(200);
    const reread = await request(server).get(`/todos/${child.id}`).expect(200);
    expect((reread.body as Todo).categoryId).toBe(sport.id);
  });

  it('inherits the why live from the nearest ancestor that has one', async () => {
    type WithWhy = Todo & {
      inheritedWhy: { text: string; fromId: number; fromTitle: string } | null;
    };
    const read = async (id: number): Promise<WithWhy> =>
      (await request(server).get(`/todos/${id}`).expect(200)).body as WithWhy;
    const root = await todo({ why: 'Gesund bleiben' });
    const middle = await todo({ parentId: root.id });
    const leaf = await todo({ parentId: middle.id });

    expect(await read(root.id)).toMatchObject({ inheritedWhy: null });
    expect(await read(leaf.id)).toMatchObject({
      why: null,
      inheritedWhy: { text: 'Gesund bleiben', fromId: root.id },
    });

    // Nothing was copied: a changed reason reaches the todos below it.
    await request(server)
      .patch(`/todos/${root.id}`)
      .send({ why: 'Marathon laufen' })
      .expect(200);
    expect((await read(leaf.id)).inheritedWhy?.text).toBe('Marathon laufen');

    // An own reason wins, and from there on is what the todos below inherit.
    await request(server)
      .patch(`/todos/${middle.id}`)
      .send({ why: 'Knie schonen' })
      .expect(200);
    expect(await read(middle.id)).toMatchObject({
      why: 'Knie schonen',
      inheritedWhy: { fromId: root.id },
    });
    expect((await read(leaf.id)).inheritedWhy).toMatchObject({
      text: 'Knie schonen',
      fromId: middle.id,
    });

    // Clearing the own reason goes back to inheriting.
    await request(server)
      .patch(`/todos/${middle.id}`)
      .send({ why: '' })
      .expect(200);
    expect((await read(leaf.id)).inheritedWhy?.fromId).toBe(root.id);
  });

  it('keeps entries when a category is deleted and frees its name', async () => {
    const { id } = await category('Sport');
    const entry = await todo({ categoryId: id });
    await request(server).delete(`/categories/${id}`).expect(204);

    const reread = await request(server).get(`/todos/${entry.id}`).expect(200);
    expect((reread.body as Todo).categoryId).toBeNull();
    expect(
      await db
        .getRepository(CategoryEntity)
        .findOne({ where: { id }, withDeleted: true }),
    ).toMatchObject({ name: 'Sport' });
    await category('Sport');
  });

  it("never exposes or accepts another user's category", async () => {
    const foreign = await db
      .getRepository(CategoryEntity)
      .save({ userId: OTHER_USER, name: 'Fremd' });
    const list = await request(server).get('/categories').expect(200);
    expect(list.body).toEqual([]);
    await request(server)
      .patch(`/categories/${foreign.id}`)
      .send({ name: 'Meins' })
      .expect(404);
    await request(server).delete(`/categories/${foreign.id}`).expect(404);
    await request(server)
      .post('/todos')
      .send({ title: 'Test', categoryId: foreign.id })
      .expect(400);
    expect(await db.getRepository(TodoEntity).count()).toBe(0);
  });

  it('reports the Perfect Week in the history week view', async () => {
    const { id } = await category('Sport');
    await request(server)
      .patch(`/categories/${id}`)
      .send({ weeklyTarget: 1 })
      .expect(200);
    const entry = await todo({ categoryId: id });
    const week = async () =>
      (await request(server).get('/history?view=week').expect(200)).body as {
        perfectWeek: { perfect: boolean; categories: unknown[] };
      };
    expect((await week()).perfectWeek.perfect).toBe(false);

    await request(server)
      .patch(`/todos/${entry.id}`)
      .send({ completed: true })
      .expect(200);
    expect((await week()).perfectWeek).toMatchObject({
      perfect: true,
      categories: [{ target: 1, completed: 1, reached: true }],
    });
  });

  it('shows the category name and colour in the day planner', async () => {
    const { id } = await category('Sport');
    await request(server)
      .patch(`/categories/${id}`)
      .send({ color: 'teal' })
      .expect(200);
    await todo({
      categoryId: id,
      scheduledDate: dayOf(new Date()),
    });
    const planner = await request(server).get('/day-planner/today').expect(200);
    expect((planner.body as { items: unknown[] }).items[0]).toMatchObject({
      categoryName: 'Sport',
      categoryColor: 'teal',
    });
  });
});
