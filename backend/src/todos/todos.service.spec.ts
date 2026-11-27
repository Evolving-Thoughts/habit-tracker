import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import * as timerTarget from '../timers/timer-target';
import * as campaignBoard from './campaign-board';
import { TodoEntity } from './entities/todo.entity';
import * as queries from './todo-hierarchy.queries';
import { TodosService } from './todos.service';

jest.mock('./todo-hierarchy.queries');
jest.mock('../timers/timer-target', () => ({
  ...jest.requireActual<typeof timerTarget>('../timers/timer-target'),
  timersOfTodos: jest.fn().mockResolvedValue([]),
  discardTimersOfTodos: jest.fn(),
  releaseTimers: jest.fn(),
}));
jest.mock('./campaign-board', () => ({
  ...jest.requireActual<typeof campaignBoard>('./campaign-board'),
  inProgressTodoIds: jest.fn(),
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
    scheduledDate: null,
    timeOfDay: null,
    dayPosition: null,
    backlogPosition: null,
    plannedDurationMinutes: null,
    weeklyTargetMinutes: null,
    color: null,
    icon: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  });
}

describe('TodosService', () => {
  let service: TodosService;
  let rows: TodoEntity[];
  /** The highest Questlog place the database would report. */
  let lastBacklog: number | null;
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
    update: jest.fn(() => Promise.resolve()),
    createQueryBuilder: () => {
      const chain = {
        softDelete: () => chain,
        // Ending a Fokus-Sperre with the quest it belongs to.
        update: () => chain,
        set: () => chain,
        select: () => chain,
        where: () => chain,
        andWhere: (_: string, params?: object) => {
          if (params) softDelete(params);
          return chain;
        },
        execute: () => Promise.resolve(),
        getMany: () => Promise.resolve([]),
        // MIN or MAX, whichever is asked: the edge of the Questlog's order.
        getRawOne: () => Promise.resolve({ edge: lastBacklog }),
      };
      return chain;
    },
  };
  const manager = { getRepository: () => repository };
  Object.assign(repository, { manager });
  const chain = jest.mocked(queries.ancestorChain);
  const subtree = jest.mocked(queries.subtree);
  const inProgress = jest.mocked(campaignBoard.inProgressTodoIds);
  const releaseTimers = jest.mocked(timerTarget.releaseTimers);

  beforeEach(() => {
    jest.clearAllMocks();
    rows = [todo()];
    lastBacklog = null;
    inProgress.mockResolvedValue(new Set());
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
      { now: () => NOW, today: () => '2026-10-02' },
      {
        run: (_userId: string, work: (m: unknown) => unknown) => work(manager),
      } as unknown as UserUnitOfWork,
    );
  });

  describe('create', () => {
    it('puts a quest without a day at the end of the Questlog', async () => {
      lastBacklog = 4;
      expect(await service.create(USER, { title: 'Neu' })).toMatchObject({
        scheduledDate: null,
        backlogPosition: 5,
      });
      lastBacklog = null;
      expect(await service.create(USER, { title: 'Erste' })).toMatchObject({
        backlogPosition: 0,
      });
      expect(
        await service.create(USER, {
          title: 'Geplant',
          scheduledDate: '2026-10-02',
        }),
      ).toMatchObject({ backlogPosition: null });
    });
    it('puts a quest without a day at the head of the Questlog when asked', async () => {
      lastBacklog = 4;
      expect(
        await service.create(USER, { title: 'Oben', backlogPlace: 'top' }),
      ).toMatchObject({ scheduledDate: null, backlogPosition: 3 });
      lastBacklog = null;
      expect(
        await service.create(USER, { title: 'Erste', backlogPlace: 'top' }),
      ).toMatchObject({ backlogPosition: 0 });
      expect(
        await service.create(USER, {
          title: 'Geplant',
          scheduledDate: '2026-10-02',
          backlogPlace: 'top',
        }),
      ).toMatchObject({ backlogPosition: null });
    });
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
    it('rejects an appointment without a day', async () => {
      await expect(
        service.create(USER, { title: 'Fix', timeOfDay: '09:00' }),
      ).rejects.toThrow(BadRequestException);
    });
    it('gives a new campaign its goal, colour and icon', async () => {
      await expect(
        service.create(USER, {
          title: 'Buch',
          weeklyTargetMinutes: 300,
          color: 'berry',
          icon: 'book',
        }),
      ).resolves.toMatchObject({
        weeklyTargetMinutes: 300,
        color: 'berry',
        icon: 'book',
      });
    });
    it('rejects a goal, colour or icon on a new child with 400', async () => {
      for (const field of [
        { weeklyTargetMinutes: 60 },
        { color: 'moss' as const },
        { icon: 'flag' as const },
      ])
        await expect(
          service.create(USER, { title: 'Child', parentId: 1, ...field }),
        ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
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
    it('plans a todo and completes it through saveQuest', async () => {
      // The rules of a plan and a completion are tested in quest-commands.spec.ts.
      lastBacklog = 6;
      expect(
        await service.update(USER, 1, {
          title: 'Neu',
          scheduledDate: '2026-10-02',
          timeOfDay: '10:00',
          plannedDurationMinutes: 15,
          completed: true,
        }),
      ).toMatchObject({
        title: 'Neu',
        scheduledDate: '2026-10-02',
        timeOfDay: '10:00',
        plannedDurationMinutes: 15,
        completedAt: NOW,
      });
      await expect(
        service.update(USER, 1, { scheduledDate: null, timeOfDay: '10:00' }),
      ).rejects.toThrow(BadRequestException);
    });
    it('marks and unmarks an open todo as blocked', async () => {
      expect(await service.update(USER, 1, { blocked: true })).toMatchObject({
        blocked: true,
      });
      expect(await service.update(USER, 1, { blocked: false })).toMatchObject({
        blocked: false,
      });
    });
    it('refuses to block a completed todo with 409', async () => {
      rows = [todo(1, null, true)];
      await expect(service.update(USER, 1, { blocked: true })).rejects.toThrow(
        ConflictException,
      );
      rows = [todo(2)];
      await expect(
        service.update(USER, 2, { blocked: true, completed: true }),
      ).rejects.toThrow(ConflictException);
    });
    it('keeps parent and child completion independent', async () => {
      rows = [todo(1, null, true), todo(2, 1, true)];
      await service.update(USER, 2, { completed: false });
      expect(rows[0]).toMatchObject({ completed: true });
      await service.update(USER, 1, { completed: false });
      expect(rows[1]).toMatchObject({ completed: false });
    });
    it('rejects a goal, colour or icon on a todo with a parent', async () => {
      rows = [todo(1), todo(2, 1)];
      await expect(service.update(USER, 2, { color: 'moss' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.update(USER, 1, { parentId: null, icon: 'star' }),
      ).resolves.toMatchObject({ icon: 'star' });
      await expect(
        service.update(USER, 1, { parentId: 2, weeklyTargetMinutes: 60 }),
      ).rejects.toThrow(BadRequestException);
    });
    it('clears goal, colour and icon when a campaign moves below a todo', async () => {
      rows = [
        Object.assign(todo(1), {
          weeklyTargetMinutes: 600,
          color: 'pine',
          icon: 'leaf',
        }),
        todo(2),
      ];
      await service.update(USER, 1, { parentId: 2 });
      expect(rows[0]).toMatchObject({
        parentId: 2,
        weeklyTargetMinutes: null,
        color: null,
        icon: null,
      });
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

  describe('reorderBacklog', () => {
    beforeEach(() => {
      rows = [1, 2, 3, 4].map((id) =>
        Object.assign(todo(id), { backlogPosition: id - 1 }),
      );
    });
    it('puts the given quests first and keeps the rest in their order', async () => {
      await service.reorderBacklog(USER, [3, 1]);
      expect(repository.update.mock.calls).toEqual([
        [{ id: 3, userId: USER }, { backlogPosition: 0 }],
        [{ id: 1, userId: USER }, { backlogPosition: 1 }],
        [{ id: 2, userId: USER }, { backlogPosition: 2 }],
      ]);
    });
    it('writes nothing when a quest is not in the Questlog', async () => {
      await expect(service.reorderBacklog(USER, [2, 99])).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
    it('refuses a quest named twice', async () => {
      await expect(service.reorderBacklog(USER, [2, 2])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('hierarchy', () => {
    it('adds the progress of the todos below to every todo', async () => {
      rows = [todo(1), todo(2, 1, true)];
      const result = await service.hierarchy(USER);
      expect(
        result.map((r) => [r.id, r.progress.completed, r.progress.todoCount]),
      ).toEqual([
        [1, 1, 1],
        [2, 0, 0],
      ]);
    });
    it('reports the reason a todo inherits, next to its own', async () => {
      rows = [
        Object.assign(todo(1), { why: 'Gesund bleiben' }),
        todo(2, 1),
        Object.assign(todo(3, 2), { why: 'Eigenes' }),
      ];
      const result = await service.hierarchy(USER);
      expect(result.map((r) => [r.why, r.inheritedWhy?.fromId])).toEqual([
        ['Gesund bleiben', undefined],
        [null, 1],
        ['Eigenes', 1],
      ]);
    });
    it('marks the todos in progress', async () => {
      rows = [todo(1), todo(2, 1)];
      inProgress.mockResolvedValue(new Set([2]));
      const result = await service.hierarchy(USER);
      expect(result.map((r) => [r.id, r.inProgress])).toEqual([
        [1, false],
        [2, true],
      ]);
      expect(inProgress).toHaveBeenCalledWith(manager, USER, rows);
    });
    it('reports a stored cycle as a server error', async () => {
      rows = [todo(1, 2), todo(2, 1)];
      await expect(service.hierarchy(USER)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('startWork', () => {
    it('stamps the moment, lifts the marker and starts no stopwatch', async () => {
      rows = [{ ...todo(1), blocked: true }];
      expect(await service.startWork(USER, 1)).toMatchObject({
        startedAt: NOW,
        blocked: false,
      });
      expect(releaseTimers).not.toHaveBeenCalled();
    });
    it('returns 404 for a missing todo and 409 for a completed one', async () => {
      await expect(service.startWork(USER, 99)).rejects.toThrow(
        NotFoundException,
      );
      rows = [todo(1, null, true)];
      await expect(service.startWork(USER, 1)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('setAside', () => {
    it('stamps the moment, sets the marker and ends the stopwatch', async () => {
      expect(await service.setAside(USER, 1, true)).toMatchObject({
        setAsideAt: NOW,
        blocked: true,
      });
      expect(releaseTimers).toHaveBeenCalledWith(
        manager,
        USER,
        { todoIds: [1] },
        NOW,
      );
      expect(await service.setAside(USER, 1, false)).toMatchObject({
        blocked: false,
      });
    });
    it('returns 404 for a missing todo and 409 for a completed one', async () => {
      await expect(service.setAside(USER, 99, false)).rejects.toThrow(
        NotFoundException,
      );
      rows = [todo(1, null, true)];
      await expect(service.setAside(USER, 1, false)).rejects.toThrow(
        ConflictException,
      );
      expect(releaseTimers).not.toHaveBeenCalled();
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
        NOW,
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
