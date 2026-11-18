import { Test, TestingModule } from '@nestjs/testing';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { GoalSnapshotsService } from './goal-snapshots.service';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { TodoAncestry } from './todo-ancestry';

type TodosServiceMock = {
  findAll: jest.MockedFunction<() => Promise<TodoEntity[]>>;

  findOne: jest.MockedFunction<(id: number) => Promise<TodoEntity>>;

  create: jest.MockedFunction<
    (createTodoDto: CreateTodoDto) => Promise<TodoEntity>
  >;

  update: jest.MockedFunction<
    (id: number, updateTodoDto: UpdateTodoDto) => Promise<TodoEntity>
  >;

  remove: jest.MockedFunction<(id: number) => Promise<void>>;

  ancestry: jest.MockedFunction<() => Promise<TodoAncestry>>;
};

describe('TodosController', () => {
  let controller: TodosController;
  let serviceMock: TodosServiceMock;

  const todo: TodoEntity = {
    id: 1,
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
    userId: '11111111-1111-4111-8111-111111111111',
    title: 'Learn NestJS',
    completed: false,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    dayPosition: null,
    plannedDurationMinutes: null,
    createdAt: new Date('2026-09-18T10:00:00.000Z'),
    updatedAt: new Date('2026-09-18T10:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      ancestry: jest.fn().mockResolvedValue(new TodoAncestry([], '2026-09-18')),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        { provide: GoalSnapshotsService, useValue: {} },
        {
          provide: TodosService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(TodosController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('maps all todos to response DTOs', async () => {
      serviceMock.findAll.mockResolvedValue([todo]);

      await expect(
        controller.findAll({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'test@example.test',
        }),
      ).resolves.toEqual([
        {
          id: 1,
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
          title: 'Learn NestJS',
          completed: false,
          completedAt: null,
          scheduledDate: null,
          timeOfDay: null,
          plannedDurationMinutes: null,
          timerEligible: true,
        },
      ]);

      expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('maps the requested todo to a response DTO', async () => {
      serviceMock.findOne.mockResolvedValue(todo);

      await expect(
        controller.findOne(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          1,
        ),
      ).resolves.toEqual({
        id: 1,
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
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: true,
      });

      expect(serviceMock.findOne).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        1,
      );
    });
  });

  describe('create', () => {
    it('creates and maps an unscheduled todo', async () => {
      const createTodoDto: CreateTodoDto = {
        title: 'Learn NestJS',
      };

      serviceMock.create.mockResolvedValue(todo);

      await expect(
        controller.create(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          createTodoDto,
        ),
      ).resolves.toEqual({
        id: 1,
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
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: true,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        createTodoDto,
      );
    });

    it('creates and maps an appointment', async () => {
      const createTodoDto: CreateTodoDto = {
        title: 'Doctor appointment',
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
      };

      const scheduledTodo: TodoEntity = {
        ...todo,
        id: 2,
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
        title: 'Doctor appointment',
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
      };

      serviceMock.create.mockResolvedValue(scheduledTodo);

      await expect(
        controller.create(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          createTodoDto,
        ),
      ).resolves.toEqual({
        id: 2,
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
        title: 'Doctor appointment',
        completed: false,
        completedAt: null,
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
        timerEligible: true,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        createTodoDto,
      );
    });
  });

  describe('update', () => {
    it('maps completedAt to an ISO string', async () => {
      const completedAt = new Date('2026-09-21T10:30:00.000Z');

      const updateTodoDto: UpdateTodoDto = {
        completed: true,
      };

      const completedTodo: TodoEntity = {
        ...todo,
        completed: true,
        completedAt,
      };

      serviceMock.update.mockResolvedValue(completedTodo);

      await expect(
        controller.update(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          1,
          updateTodoDto,
        ),
      ).resolves.toEqual({
        id: 1,
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
        title: 'Learn NestJS',
        completed: true,
        completedAt: '2026-09-21T10:30:00.000Z',
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: false,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        1,
        updateTodoDto,
      );
    });

    it('maps a reopened todo with completedAt null', async () => {
      const updateTodoDto: UpdateTodoDto = {
        completed: false,
      };

      const reopenedTodo: TodoEntity = {
        ...todo,
        completed: false,
        completedAt: null,
      };

      serviceMock.update.mockResolvedValue(reopenedTodo);

      await expect(
        controller.update(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          1,
          updateTodoDto,
        ),
      ).resolves.toEqual({
        id: 1,
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
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: null,
        timeOfDay: null,
        plannedDurationMinutes: null,
        timerEligible: true,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        1,
        updateTodoDto,
      );
    });

    it('maps scheduling values', async () => {
      const updateTodoDto: UpdateTodoDto = {
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
      };

      const updatedTodo: TodoEntity = {
        ...todo,
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
      };

      serviceMock.update.mockResolvedValue(updatedTodo);

      await expect(
        controller.update(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          1,
          updateTodoDto,
        ),
      ).resolves.toEqual({
        id: 1,
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
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledDate: '2026-09-20',
        timeOfDay: '12:00',
        plannedDurationMinutes: 30,
        timerEligible: true,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        1,
        updateTodoDto,
      );
    });
  });

  describe('remove', () => {
    it('removes the todo without returning a response body', async () => {
      serviceMock.remove.mockResolvedValue(undefined);

      await expect(
        controller.remove(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          1,
          { confirmationToken: 'a'.repeat(64) },
        ),
      ).resolves.toBeUndefined();

      expect(serviceMock.remove).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        1,
        'a'.repeat(64),
      );
    });
  });
});
