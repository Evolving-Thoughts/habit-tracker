import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoEntity } from './entities/todo.entity';
import { TodosService } from './todos.service';

type TodoRepositoryMock = jest.Mocked<
  Pick<
    Repository<TodoEntity>,
    'find' | 'findOneBy' | 'create' | 'save' | 'preload' | 'softRemove'
  >
>;

describe('TodosService', () => {
  let service: TodosService;
  let repository: TodoRepositoryMock;

  const todo: TodoEntity = {
    id: 1,
    title: 'Learn NestJS',
    completed: false,
    scheduledAt: null,
    plannedDurationMinutes: null,
    isFixed: false,
    createdAt: new Date('2026-09-18T10:00:00.000Z'),
    updatedAt: new Date('2026-09-18T10:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      preload: jest.fn(),
      softRemove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: getRepositoryToken(TodoEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(TodosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all non-deleted todos', async () => {
      repository.find.mockResolvedValue([todo]);

      await expect(service.findAll()).resolves.toEqual([todo]);

      expect(repository.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('returns the requested todo', async () => {
      repository.findOneBy.mockResolvedValue(todo);

      await expect(service.findOne(1)).resolves.toEqual(todo);

      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });
    });

    it('throws NotFoundException when the todo does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);

      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });
  });

  describe('create', () => {
    it('creates and saves an unscheduled flexible todo', async () => {
      const unsavedTodo = {
        title: 'Learn NestJS',
        completed: false,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      } as TodoEntity;

      repository.create.mockReturnValue(unsavedTodo);
      repository.save.mockResolvedValue(todo);

      await expect(
        service.create({
          title: 'Learn NestJS',
        }),
      ).resolves.toEqual(todo);

      expect(repository.create).toHaveBeenCalledWith({
        title: 'Learn NestJS',
        completed: false,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      expect(repository.save).toHaveBeenCalledWith(unsavedTodo);
    });

    it('creates and saves a scheduled fixed todo', async () => {
      const scheduledAt = '2026-09-20T10:00:00.000Z';

      const unsavedTodo = {
        title: 'Doctor appointment',
        completed: false,
        scheduledAt: new Date(scheduledAt),
        plannedDurationMinutes: 30,
        isFixed: true,
      } as TodoEntity;

      const savedTodo: TodoEntity = {
        ...unsavedTodo,
        id: 2,
        createdAt: new Date('2026-09-18T10:00:00.000Z'),
        updatedAt: new Date('2026-09-18T10:00:00.000Z'),
        deletedAt: null,
      };

      repository.create.mockReturnValue(unsavedTodo);
      repository.save.mockResolvedValue(savedTodo);

      await expect(
        service.create({
          title: 'Doctor appointment',
          scheduledAt,
          plannedDurationMinutes: 30,
          isFixed: true,
        }),
      ).resolves.toEqual(savedTodo);

      expect(repository.create).toHaveBeenCalledWith({
        title: 'Doctor appointment',
        completed: false,
        scheduledAt: new Date(scheduledAt),
        plannedDurationMinutes: 30,
        isFixed: true,
      });

      expect(repository.save).toHaveBeenCalledWith(unsavedTodo);
    });

    it('rejects a fixed todo without a scheduled date', async () => {
      await expect(
        service.create({
          title: 'Doctor appointment',
          isFixed: true,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the completed state', async () => {
      const updatedTodo: TodoEntity = {
        ...todo,
        completed: true,
      };

      repository.preload.mockResolvedValue(updatedTodo);
      repository.save.mockResolvedValue(updatedTodo);

      await expect(
        service.update(1, {
          completed: true,
        }),
      ).resolves.toEqual(updatedTodo);

      expect(repository.preload).toHaveBeenCalledWith({
        id: 1,
        completed: true,
      });

      expect(repository.save).toHaveBeenCalledWith(updatedTodo);
    });

    it('converts a scheduledAt string to a Date', async () => {
      const scheduledAt = '2026-09-20T10:00:00.000Z';

      const updatedTodo: TodoEntity = {
        ...todo,
        scheduledAt: new Date(scheduledAt),
      };

      repository.preload.mockResolvedValue(updatedTodo);
      repository.save.mockResolvedValue(updatedTodo);

      await expect(
        service.update(1, {
          scheduledAt,
        }),
      ).resolves.toEqual(updatedTodo);

      expect(repository.preload).toHaveBeenCalledWith({
        id: 1,
        scheduledAt: new Date(scheduledAt),
      });

      expect(repository.save).toHaveBeenCalledWith(updatedTodo);
    });

    it('allows clearing scheduling values from a flexible todo', async () => {
      const updatedTodo: TodoEntity = {
        ...todo,
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      };

      repository.preload.mockResolvedValue(updatedTodo);
      repository.save.mockResolvedValue(updatedTodo);

      await expect(
        service.update(1, {
          scheduledAt: null,
          plannedDurationMinutes: null,
        }),
      ).resolves.toEqual(updatedTodo);

      expect(repository.preload).toHaveBeenCalledWith({
        id: 1,
        scheduledAt: null,
        plannedDurationMinutes: null,
      });

      expect(repository.save).toHaveBeenCalledWith(updatedTodo);
    });

    it('rejects removing the date from a fixed todo', async () => {
      const fixedTodoWithoutDate: TodoEntity = {
        ...todo,
        scheduledAt: null,
        isFixed: true,
      };

      repository.preload.mockResolvedValue(fixedTodoWithoutDate);

      await expect(
        service.update(1, {
          scheduledAt: null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the todo does not exist', async () => {
      repository.preload.mockResolvedValue(undefined);

      await expect(
        service.update(999, {
          completed: true,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.preload).toHaveBeenCalledWith({
        id: 999,
        completed: true,
      });

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects an empty update', async () => {
      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);

      expect(repository.preload).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing todo', async () => {
      repository.findOneBy.mockResolvedValue(todo);
      repository.softRemove.mockResolvedValue(todo);

      await expect(service.remove(1)).resolves.toBeUndefined();

      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });

      expect(repository.softRemove).toHaveBeenCalledWith(todo);
    });

    it('does not call softRemove when the todo does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);

      expect(repository.softRemove).not.toHaveBeenCalled();
    });
  });
});
