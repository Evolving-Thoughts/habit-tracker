import type { TodoResponseDto } from '../src/todos/dto/todo-response.dto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { Repository, DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { addDays, dayOf } from '../src/common/date/local-day';
import { TodoEntity } from '../src/todos/entities/todo.entity';

type TodoResponseBody = {
  id: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
};

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

describe('Todos API (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let todoRepository: Repository<TodoEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();
    await seedAuth(app);

    httpServer = app.getHttpServer() as Server;

    todoRepository = moduleFixture.get<Repository<TodoEntity>>(
      getRepositoryToken(TodoEntity),
    );
  });

  beforeEach(async () => {
    await app
      .get(DataSource)
      .query(
        'TRUNCATE TABLE push_deliveries, push_subscriptions, timers, todos RESTART IDENTITY',
      );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /todos/:id/reschedule', () => {
    const tomorrow = addDays(dayOf(new Date()), 1);
    const today = dayOf(new Date());
    const scheduled = async (
      timeOfDay: string | null = null,
    ): Promise<TodoResponseBody> =>
      (
        await request(httpServer)
          .post('/todos')
          .send({
            title: 'Saugen',
            scheduledDate: today,
            timeOfDay,
            plannedDurationMinutes: 30,
          })
          .expect(201)
      ).body as TodoResponseBody;
    const move = (id: number, body: object) =>
      request(httpServer).post(`/todos/${id}/reschedule`).send(body);

    it('changes only the day', async () => {
      const todo = await scheduled();
      const response = await move(todo.id, { date: tomorrow }).expect(200);
      expect(response.body).toMatchObject({
        scheduledDate: tomorrow,
        timeOfDay: null,
        plannedDurationMinutes: 30,
      });
    });

    it('joins the new day at the end of its order', async () => {
      const todo = await scheduled();
      await request(httpServer)
        .put('/day-planner/order')
        .send({ items: [{ type: 'todo', id: todo.id }] })
        .expect(204);
      const stored = () => todoRepository.findOneByOrFail({ id: todo.id });
      expect((await stored()).dayPosition).toBe(0);
      await move(todo.id, { date: tomorrow }).expect(200);
      expect((await stored()).dayPosition).toBeNull();
    });

    it('moves an appointment only with confirmation and keeps its time', async () => {
      const todo = await scheduled('09:30');
      await move(todo.id, { date: tomorrow }).expect(409);
      const moved = await move(todo.id, {
        date: tomorrow,
        confirmFixed: true,
      }).expect(200);
      expect(moved.body).toMatchObject({
        scheduledDate: tomorrow,
        timeOfDay: '09:30',
      });
    });

    it('refuses while a timer is open', async () => {
      const todo = await scheduled();
      await request(httpServer)
        .post('/timers')
        .send({ kind: 'todo', targetId: todo.id })
        .expect(201);
      await move(todo.id, { date: tomorrow }).expect(409);
    });

    it('rejects past days, completed and unknown todos', async () => {
      const todo = await scheduled();
      await move(todo.id, { date: '2000-01-01' }).expect(400);
      await move(424242, { date: tomorrow }).expect(404);
      await request(httpServer)
        .patch(`/todos/${todo.id}`)
        .send({ completed: true })
        .expect(200);
      await move(todo.id, { date: tomorrow }).expect(409);
    });
  });

  describe('POST /todos', () => {
    it('creates an unscheduled flexible todo', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Learn NestJS',
        })
        .expect(201);

      const body = response.body as TodoResponseBody;

      expect(typeof body.id).toBe('number');

      expect(body).toEqual({
        id: body.id,
        parentId: null,
        categoryId: null,
        periodStart: null,
        periodEnd: null,
        goalHabitId: null,
        goalTarget: null,
        weeklyTargetMinutes: null,
        color: null,
        icon: null,
        why: null,
        inheritedWhy: null,
        campaign: null,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: true,
      });

      const persistedTodo = await todoRepository.findOneBy({
        id: body.id,
      });

      expect(persistedTodo).not.toBeNull();
      expect(persistedTodo?.completed).toBe(false);
      expect(persistedTodo?.completedAt).toBeNull();
    });

    it('creates an appointment', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Doctor appointment',
          scheduledDate: '2026-09-20',
          timeOfDay: '12:00',
          plannedDurationMinutes: 30,
        })
        .expect(201);

      const body = response.body as TodoResponseBody;

      expect(typeof body.id).toBe('number');
      expect(body.title).toBe('Doctor appointment');
      expect(body.completed).toBe(false);
      expect(body.completedAt).toBeNull();
      expect(body.scheduledDate).toBe('2026-09-20');
      expect(body.timeOfDay).toBe('12:00');
      expect(body.plannedDurationMinutes).toBe(30);
    });

    it('rejects an appointment without a day', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Doctor appointment',
          timeOfDay: '12:00',
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('An appointment needs a day');

      expect(await todoRepository.count()).toBe(0);
    });

    it('rejects unknown properties', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Learn NestJS',
          admin: true,
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toContain('property admin should not exist');
    });
  });

  describe('Todo CRUD flow', () => {
    it('creates, reads, updates and deletes a todo', async () => {
      const createResponse = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Learn NestJS',
        })
        .expect(201);

      const createdTodo = createResponse.body as TodoResponseBody;

      expect(createdTodo.completedAt).toBeNull();

      const getResponse = await request(httpServer)
        .get(`/todos/${createdTodo.id}`)
        .expect(200);

      expect(getResponse.body as TodoResponseBody).toEqual(createdTodo);

      const listResponse = await request(httpServer).get('/todos').expect(200);

      expect(listResponse.body as TodoResponseBody[]).toEqual([createdTodo]);

      const completeResponse = await request(httpServer)
        .patch(`/todos/${createdTodo.id}`)
        .send({
          completed: true,
          scheduledDate: '2026-09-21',
          plannedDurationMinutes: 60,
        })
        .expect(200);

      const completedTodo = completeResponse.body as TodoResponseBody;

      expect(completedTodo.completed).toBe(true);
      expect(completedTodo.completedAt).not.toBeNull();
      expect(completedTodo.scheduledDate).toBe('2026-09-21');
      expect(completedTodo.plannedDurationMinutes).toBe(60);

      expect(Number.isNaN(Date.parse(completedTodo.completedAt ?? ''))).toBe(
        false,
      );

      const originalCompletedAt = completedTodo.completedAt;

      const repeatedCompleteResponse = await request(httpServer)
        .patch(`/todos/${createdTodo.id}`)
        .send({
          completed: true,
        })
        .expect(200);

      const repeatedlyCompletedTodo =
        repeatedCompleteResponse.body as TodoResponseBody;

      expect(repeatedlyCompletedTodo.completedAt).toBe(originalCompletedAt);

      const reopenResponse = await request(httpServer)
        .patch(`/todos/${createdTodo.id}`)
        .send({
          completed: false,
        })
        .expect(200);

      const reopenedTodo = reopenResponse.body as TodoResponseBody;

      expect(reopenedTodo.completed).toBe(false);
      expect(reopenedTodo.completedAt).toBeNull();

      await request(httpServer).delete(`/todos/${createdTodo.id}`).expect(400);
      const preview = await request(httpServer)
        .get(`/todos/${createdTodo.id}/deletion-preview`)
        .expect(200);
      await request(httpServer)
        .delete(`/todos/${createdTodo.id}`)
        .send({
          confirmationToken: (preview.body as { confirmationToken: string })
            .confirmationToken,
        })
        .expect(204)
        .expect('');

      await request(httpServer).get(`/todos/${createdTodo.id}`).expect(404);

      const listAfterDeletionResponse = await request(httpServer)
        .get('/todos')
        .expect(200);

      expect(listAfterDeletionResponse.body as TodoResponseBody[]).toEqual([]);

      const softDeletedTodo = await todoRepository.findOne({
        where: {
          id: createdTodo.id,
        },
        withDeleted: true,
      });

      expect(softDeletedTodo).not.toBeNull();
      expect(softDeletedTodo?.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('PATCH /todos/:id', () => {
    it('rejects an empty update', async () => {
      const todo = todoRepository.create({
        userId: TEST_USER,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
      });

      const savedTodo = await todoRepository.save(todo);

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({})
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('At least one property must be provided');
    });

    it('allows false and null as explicit updates', async () => {
      const todo = todoRepository.create({
        userId: TEST_USER,
        title: 'Learn NestJS',
        completed: true,
        completedAt: new Date(),
        scheduledDate: '2026-09-21',
        plannedDurationMinutes: 60,
      });

      const savedTodo = await todoRepository.save(todo);

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({
          completed: false,
          scheduledDate: null,
          plannedDurationMinutes: null,
        })
        .expect(200);

      const body = response.body as TodoResponseBody;

      expect(body.completed).toBe(false);
      expect(body.completedAt).toBeNull();
      expect(body.scheduledDate).toBeNull();
      expect(body.plannedDurationMinutes).toBeNull();
    });

    it('puts an appointment back into the backlog without its time', async () => {
      const savedTodo = await todoRepository.save(
        todoRepository.create({
          userId: TEST_USER,
          title: 'Doctor appointment',
          completed: false,
          completedAt: null,
          scheduledDate: '2026-09-21',
          timeOfDay: '10:00',
          dayPosition: 2,
          plannedDurationMinutes: 30,
        }),
      );

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({ scheduledDate: null })
        .expect(200);

      expect(response.body).toMatchObject({
        scheduledDate: null,
        timeOfDay: null,
      });
      expect(
        (await todoRepository.findOneByOrFail({ id: savedTodo.id }))
          .dayPosition,
      ).toBeNull();
    });

    it('turns an appointment into a todo of its day by clearing the time', async () => {
      const savedTodo = await todoRepository.save(
        todoRepository.create({
          userId: TEST_USER,
          title: 'Doctor appointment',
          completed: false,
          completedAt: null,
          scheduledDate: '2026-09-21',
          timeOfDay: '10:00',
          plannedDurationMinutes: 30,
        }),
      );

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({ timeOfDay: null })
        .expect(200);

      expect(response.body).toMatchObject({
        scheduledDate: '2026-09-21',
        timeOfDay: null,
      });
    });

    it('rejects malformed days and times', async () => {
      for (const body of [
        { title: 'x', scheduledDate: '2026-09-21T08:00:00.000Z' },
        { title: 'x', scheduledDate: '2026-02-31' },
        { title: 'x', scheduledDate: '2026-09-21', timeOfDay: '24:00' },
        { title: 'x', scheduledAt: '2026-09-21T08:00:00.000Z' },
      ])
        await request(httpServer).post('/todos').send(body).expect(400);
    });
  });

  describe('GET /todos/backlog', () => {
    it('returns only open todos without a day (Questlog)', async () => {
      const create = async (body: object) =>
        (
          (await request(httpServer).post('/todos').send(body).expect(201))
            .body as TodoResponseDto
        ).id;
      const open = await create({ title: 'Offen' });
      await create({ title: 'Geplant', scheduledDate: '2026-10-02' });
      const done = await create({ title: 'Erledigt' });
      await request(httpServer)
        .patch(`/todos/${done}`)
        .send({ completed: true })
        .expect(200);

      const response = await request(httpServer)
        .get('/todos/backlog')
        .expect(200);

      expect((response.body as TodoResponseDto[]).map((t) => t.id)).toEqual([
        open,
      ]);
    });

    it('names the campaign each backlog todo works towards', async () => {
      const create = async (body: object) =>
        (
          (await request(httpServer).post('/todos').send(body).expect(201))
            .body as TodoResponseDto
        ).id;
      const campaign = await create({ title: 'Marathon', color: 'berry' });
      const step = await create({ title: 'Schuhe kaufen', parentId: campaign });
      const loose = await create({ title: 'Lose' });

      const response = await request(httpServer)
        .get('/todos/backlog')
        .expect(200);
      const byId = new Map(
        (response.body as TodoResponseDto[]).map((t) => [t.id, t.campaign]),
      );

      expect(byId.get(step)).toEqual({
        id: campaign,
        title: 'Marathon',
        color: 'berry',
        icon: null,
      });
      expect(byId.get(campaign)).toMatchObject({ id: campaign });
      expect(byId.get(loose)).toBeNull();
    });
  });

  describe('GET /todos/:id', () => {
    it('returns 400 for a non-numeric ID', async () => {
      const response = await request(httpServer)
        .get('/todos/not-a-number')
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
    });

    it('returns 404 for a missing todo', async () => {
      const response = await request(httpServer)
        .get('/todos/999999')
        .expect(404);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Todo with ID 999999 was not found');
    });
  });
});
