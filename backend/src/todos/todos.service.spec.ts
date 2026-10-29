import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import * as timerTarget from '../timers/timer-target';
import { TodoEntity } from './entities/todo.entity';
import * as queries from './todo-hierarchy.queries';
import { TodosService } from './todos.service';

jest.mock('./todo-hierarchy.queries');
jest.mock('../timers/timer-target', () => ({
  ...jest.requireActual<typeof timerTarget>('../timers/timer-target'),
  releaseTimers: jest.fn(),
  timersOfTodos: jest.fn().mockResolvedValue([]),
  discardTimersOfTodos: jest.fn(),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-02T12:00:00Z');
function todo(
  id = 1,
  parentId: number | null = null,
  completed = false,
): TodoEntity {
  return Object.assign(new TodoEntity(), {
    id,
    userId: USER,
    parentId,
    title: 'Task',
    completed,
    completedAt: completed ? new Date('2026-01-01') : null,
    scheduledAt: null,
    isFixed: false,
    plannedDurationMinutes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  });
}

describe('TodosService', () => {
  let service: TodosService;
  let rows: TodoEntity[];
  const softDelete = jest.fn();
  const repository = {
    find: jest.fn(() => Promise.resolve(rows)),
    findOneBy: jest.fn(({ id }: { id: number }) =>
      Promise.resolve(rows.find((t) => t.id === id) ?? null),
    ),
    create: jest.fn((value: Partial<TodoEntity>) =>
      Object.assign(new TodoEntity(), value, { id: 9 }),
    ),
    save: jest.fn((value: TodoEntity) => Promise.resolve(value)),
    createQueryBuilder: () => {
      const chain = {
        softDelete: () => chain,
        where: () => chain,
        andWhere: (_: string, params: object) => {
          softDelete(params);
          return chain;
        },
        execute: () => Promise.resolve(),
      };
      return chain;
    },
  };
  const manager = { getRepository: () => repository };
  const chain = jest.mocked(queries.ancestorChain);
  const subtree = jest.mocked(queries.subtree);

  beforeEach(() => {
    jest.clearAllMocks();
    rows = [todo()];
    chain.mockImplementation((_m, _u, id) =>
      Promise.resolve(
        // Ancestor chain of `id` within `rows`.
        (() => {
          const result: TodoEntity[] = [];
          let current: number | null = id;
          while (current !== null) {
            const node = rows.find((t) => t.id === current);
            if (!node || result.includes(node)) break;
            result.push(node);
            current = node.parentId;
          }
          return result;
        })(),
      ),
    );
    service = new TodosService(
      repository as unknown as Repository<TodoEntity>,
      { now: () => NOW } as Clock,
      {
        run: (_userId: string, work: (m: unknown) => unknown) => work(manager),
      } as unknown as UserUnitOfWork,
    );
  });

  describe('create', () => {
    it('creates a root todo', async () => {
      const created = await service.create(USER, { title: 'Root' });
      expect(created).toMatchObject({
        userId: USER,
        parentId: null,
        completed: false,
        completedAt: null,
      });
      expect(chain).not.toHaveBeenCalled();
    });
    it('creates a child below a live parent', async () => {
      await expect(
        service.create(USER, { title: 'Child', parentId: 1 }),
      ).resolves.toMatchObject({ parentId: 1 });
    });
    it('rejects an unavailable parent with 400', async () => {
      await expect(
        service.create(USER, { title: 'Child', parentId: 99 }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
    it('rejects a fixed todo without a date', async () => {
      await expect(
        service.create(USER, { title: 'Fix', isFixed: true }),
      ).rejects.toThrow(BadRequestException);
    });
    it('does not reopen a completed parent when a child is added', async () => {
      rows = [todo(1, null, true)];
      await service.create(USER, { title: 'Child', parentId: 1 });
      expect(rows[0]).toMatchObject({ completed: true });
      expect(repository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('rejects an empty update', async () => {
      await expect(service.update(USER, 1, {})).rejects.toThrow(
        BadRequestException,
      );
    });
    it('returns 404 for a missing todo', async () => {
      await expect(service.update(USER, 99, { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
    it('converts and clears scheduling values of a flexible todo', async () => {
      const scheduled = await service.update(USER, 1, {
        scheduledAt: '2026-10-02T08:00:00.000Z',
        plannedDurationMinutes: 15,
      });
      expect(scheduled.scheduledAt).toEqual(new Date('2026-10-02T08:00:00Z'));
      const cleared = await service.update(USER, 1, {
        scheduledAt: null,
        plannedDurationMinutes: null,
      });
      expect(cleared).toMatchObject({
        scheduledAt: null,
        plannedDurationMinutes: null,
      });
    });
    it('rejects removing the date from a fixed todo', async () => {
      rows = [
        Object.assign(todo(), {
          isFixed: true,
          scheduledAt: new Date('2026-10-02T08:00:00Z'),
        }),
      ];
      await expect(
        service.update(USER, 1, { scheduledAt: null }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
    it('stamps completion with the clock and keeps it on repeat', async () => {
      await service.update(USER, 1, { completed: true });
      expect(rows[0].completedAt).toEqual(NOW);
      rows[0].completedAt = new Date('2026-01-01');
      await service.update(USER, 1, { completed: true });
      expect(rows[0].completedAt).toEqual(new Date('2026-01-01'));
    });
    it('clears completedAt when reopening', async () => {
      rows = [todo(1, null, true)];
      await service.update(USER, 1, { completed: false });
      expect(rows[0]).toMatchObject({ completed: false, completedAt: null });
    });
    it('releases timers when completing, not when editing', async () => {
      await service.update(USER, 1, { title: 'Neu' });
      expect(timerTarget.releaseTimers).not.toHaveBeenCalled();
      await service.update(USER, 1, { completed: true });
      expect(timerTarget.releaseTimers).toHaveBeenCalledWith(manager, USER, {
        todoIds: [1],
      });
    });
    it('keeps parent and child completion independent', async () => {
      rows = [todo(1, null, true), todo(2, 1, true)];
      await service.update(USER, 2, { completed: false });
      expect(rows[0]).toMatchObject({ completed: true });
      await service.update(USER, 1, { completed: false });
      expect(rows[1]).toMatchObject({ completed: false });
    });
    it('moves a subtree and rejects moving below a descendant', async () => {
      rows = [todo(1), todo(2, 1), todo(3, 2), todo(4)];
      await expect(service.update(USER, 1, { parentId: 3 })).rejects.toThrow(
        'below itself or a descendant',
      );
      await service.update(USER, 2, { parentId: 4 });
      expect(rows[1].parentId).toBe(4);
      await service.update(USER, 2, { parentId: null });
      expect(rows[1].parentId).toBeNull();
    });
  });

  describe('hierarchy', () => {
    it('adds subtree progress to every todo', async () => {
      rows = [todo(1), todo(2, 1, true)];
      const result = await service.hierarchy(USER);
      expect(result.map((r) => [r.id, r.progress.completed])).toEqual([
        [1, 1],
        [2, 1],
      ]);
    });
    it('reports a stored cycle as a server error', async () => {
      rows = [todo(1, 2), todo(2, 1)];
      await expect(service.hierarchy(USER)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deletion', () => {
    beforeEach(() => {
      rows = [todo(1), todo(2, 1)];
      subtree.mockResolvedValue(rows);
    });
    it('deletes the previewed subtree and its timers', async () => {
      const { confirmationToken, todos } = await service.deletionPreview(
        USER,
        1,
      );
      expect(todos.map((t) => t.id)).toEqual([1, 2]);
      await service.remove(USER, 1, confirmationToken);
      expect(timerTarget.discardTimersOfTodos).toHaveBeenCalledWith(
        manager,
        USER,
        [1, 2],
      );
      expect(softDelete).toHaveBeenCalledWith({ ids: [1, 2] });
    });
    it('rejects a token from an outdated preview', async () => {
      const { confirmationToken } = await service.deletionPreview(USER, 1);
      rows[1].updatedAt = new Date('2026-02-01');
      await expect(service.remove(USER, 1, confirmationToken)).rejects.toThrow(
        ConflictException,
      );
      expect(softDelete).not.toHaveBeenCalled();
    });
    it('returns 404 for a missing todo', async () => {
      subtree.mockResolvedValue([]);
      await expect(service.deletionPreview(USER, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
