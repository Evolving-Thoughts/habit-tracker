import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/auth/auth.entities';
import { CategoryEntity } from '../src/categories/category.entity';
import { configureApp } from '../src/configure-app';
import { TodoEntity } from '../src/todos/entities/todo.entity';
import { authenticatedRequest as request, seedAuth } from './auth-fixture';

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
    expect(list.body).toEqual([
      { id: created.id, name: 'Musik', weeklyTarget: null },
    ]);
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

  it('shows the category name in the day planner', async () => {
    const { id } = await category('Sport');
    await todo({
      categoryId: id,
      scheduledAt: new Date().toISOString(),
    });
    const planner = await request(server).get('/day-planner/today').expect(200);
    expect((planner.body as { items: unknown[] }).items[0]).toMatchObject({
      categoryName: 'Sport',
    });
  });
});
