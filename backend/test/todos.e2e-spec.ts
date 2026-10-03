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
import { TodoEntity } from '../src/todos/entities/todo.entity';

type TodoResponseBody = {
  id: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
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
      .query('TRUNCATE TABLE timers, todos RESTART IDENTITY');
  });

  afterAll(async () => {
    await app.close();
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
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      const persistedTodo = await todoRepository.findOneBy({
        id: body.id,
      });

      expect(persistedTodo).not.toBeNull();
      expect(persistedTodo?.completed).toBe(false);
      expect(persistedTodo?.completedAt).toBeNull();
    });

    it('creates a scheduled fixed todo', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Doctor appointment',
          scheduledAt: '2026-09-20T10:00:00.000Z',
          plannedDurationMinutes: 30,
          isFixed: true,
        })
        .expect(201);

      const body = response.body as TodoResponseBody;

      expect(typeof body.id).toBe('number');
      expect(body.title).toBe('Doctor appointment');
      expect(body.completed).toBe(false);
      expect(body.completedAt).toBeNull();
      expect(body.scheduledAt).toBe('2026-09-20T10:00:00.000Z');
      expect(body.plannedDurationMinutes).toBe(30);
      expect(body.isFixed).toBe(true);
    });

    it('rejects a fixed todo without a date', async () => {
      const response = await request(httpServer)
        .post('/todos')
        .send({
          title: 'Doctor appointment',
          isFixed: true,
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('A fixed todo requires a scheduled date');

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
          scheduledAt: '2026-09-21T08:00:00.000Z',
          plannedDurationMinutes: 60,
        })
        .expect(200);

      const completedTodo = completeResponse.body as TodoResponseBody;

      expect(completedTodo.completed).toBe(true);
      expect(completedTodo.completedAt).not.toBeNull();
      expect(completedTodo.scheduledAt).toBe('2026-09-21T08:00:00.000Z');
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

      await request(httpServer)
        .delete(`/todos/${createdTodo.id}`)
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
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
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
        scheduledAt: new Date('2026-09-21T08:00:00.000Z'),
        plannedDurationMinutes: 60,
        isFixed: false,
      });

      const savedTodo = await todoRepository.save(todo);

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({
          completed: false,
          scheduledAt: null,
          plannedDurationMinutes: null,
        })
        .expect(200);

      const body = response.body as TodoResponseBody;

      expect(body.completed).toBe(false);
      expect(body.completedAt).toBeNull();
      expect(body.scheduledAt).toBeNull();
      expect(body.plannedDurationMinutes).toBeNull();
    });

    it('rejects removing the date from a fixed todo', async () => {
      const todo = todoRepository.create({
        userId: TEST_USER,
        title: 'Doctor appointment',
        completed: false,
        completedAt: null,
        scheduledAt: new Date('2026-09-21T08:00:00.000Z'),
        plannedDurationMinutes: 30,
        isFixed: true,
      });

      const savedTodo = await todoRepository.save(todo);

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({
          scheduledAt: null,
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('A fixed todo requires a scheduled date');
    });

    it('allows removing a date when the todo becomes flexible', async () => {
      const todo = todoRepository.create({
        userId: TEST_USER,
        title: 'Doctor appointment',
        completed: false,
        completedAt: null,
        scheduledAt: new Date('2026-09-21T08:00:00.000Z'),
        plannedDurationMinutes: 30,
        isFixed: true,
      });

      const savedTodo = await todoRepository.save(todo);

      const response = await request(httpServer)
        .patch(`/todos/${savedTodo.id}`)
        .send({
          scheduledAt: null,
          isFixed: false,
        })
        .expect(200);

      const body = response.body as TodoResponseBody;

      expect(body.scheduledAt).toBeNull();
      expect(body.isFixed).toBe(false);
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
