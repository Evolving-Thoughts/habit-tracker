import { Test, TestingModule } from '@nestjs/testing';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

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
};

describe('TodosController', () => {
  let controller: TodosController;
  let serviceMock: TodosServiceMock;

  const todo: TodoEntity = {
    id: 1,
    title: 'Learn NestJS',
    completed: false,
    completedAt: null,
    scheduledAt: null,
    plannedDurationMinutes: null,
    isFixed: false,
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
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

      await expect(controller.findAll()).resolves.toEqual([
        {
          id: 1,
          title: 'Learn NestJS',
          completed: false,
          completedAt: null,
          scheduledAt: null,
          plannedDurationMinutes: null,
          isFixed: false,
        },
      ]);

      expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('maps the requested todo to a response DTO', async () => {
      serviceMock.findOne.mockResolvedValue(todo);

      await expect(controller.findOne(1)).resolves.toEqual({
        id: 1,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      expect(serviceMock.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('creates and maps an unscheduled todo', async () => {
      const createTodoDto: CreateTodoDto = {
        title: 'Learn NestJS',
      };

      serviceMock.create.mockResolvedValue(todo);

      await expect(controller.create(createTodoDto)).resolves.toEqual({
        id: 1,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(createTodoDto);
    });

    it('creates and maps a scheduled fixed todo', async () => {
      const scheduledAt = new Date('2026-09-20T10:00:00.000Z');

      const createTodoDto: CreateTodoDto = {
        title: 'Doctor appointment',
        scheduledAt: scheduledAt.toISOString(),
        plannedDurationMinutes: 30,
        isFixed: true,
      };

      const scheduledTodo: TodoEntity = {
        ...todo,
        id: 2,
        title: 'Doctor appointment',
        scheduledAt,
        plannedDurationMinutes: 30,
        isFixed: true,
      };

      serviceMock.create.mockResolvedValue(scheduledTodo);

      await expect(controller.create(createTodoDto)).resolves.toEqual({
        id: 2,
        title: 'Doctor appointment',
        completed: false,
        completedAt: null,
        scheduledAt: '2026-09-20T10:00:00.000Z',
        plannedDurationMinutes: 30,
        isFixed: true,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(createTodoDto);
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

      await expect(controller.update(1, updateTodoDto)).resolves.toEqual({
        id: 1,
        title: 'Learn NestJS',
        completed: true,
        completedAt: '2026-09-21T10:30:00.000Z',
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(1, updateTodoDto);
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

      await expect(controller.update(1, updateTodoDto)).resolves.toEqual({
        id: 1,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(1, updateTodoDto);
    });

    it('maps scheduling values', async () => {
      const scheduledAt = new Date('2026-09-20T10:00:00.000Z');

      const updateTodoDto: UpdateTodoDto = {
        scheduledAt: scheduledAt.toISOString(),
        plannedDurationMinutes: 30,
        isFixed: true,
      };

      const updatedTodo: TodoEntity = {
        ...todo,
        scheduledAt,
        plannedDurationMinutes: 30,
        isFixed: true,
      };

      serviceMock.update.mockResolvedValue(updatedTodo);

      await expect(controller.update(1, updateTodoDto)).resolves.toEqual({
        id: 1,
        title: 'Learn NestJS',
        completed: false,
        completedAt: null,
        scheduledAt: '2026-09-20T10:00:00.000Z',
        plannedDurationMinutes: 30,
        isFixed: true,
      });

      expect(serviceMock.update).toHaveBeenCalledWith(1, updateTodoDto);
    });
  });

  describe('remove', () => {
    it('removes the todo without returning a response body', async () => {
      serviceMock.remove.mockResolvedValue(undefined);

      await expect(controller.remove(1)).resolves.toBeUndefined();

      expect(serviceMock.remove).toHaveBeenCalledWith(1);
    });
  });
});
