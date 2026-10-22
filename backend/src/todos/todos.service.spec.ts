import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TodosService } from './todos.service';
import { TodoEntity } from './entities/todo.entity';

const USER = '11111111-1111-4111-8111-111111111111';
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
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}
describe('TodosService transactional hierarchy', () => {
  let service: TodosService, rows: TodoEntity[];
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const manager = { findOne: jest.fn(), getRepository: () => repository };
  const transaction = jest.fn(
    async (fn: (manager: EntityManager) => Promise<unknown>) =>
      fn(manager as unknown as EntityManager),
  );
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [todo()];
    repository.find.mockImplementation(() => Promise.resolve(rows));
    repository.findOneBy.mockImplementation(({ id }: { id: number }) =>
      Promise.resolve(rows.find((t) => t.id === id) ?? null),
    );
    repository.create.mockImplementation((value: Partial<TodoEntity>) =>
      Object.assign(new TodoEntity(), value, { id: 9 }),
    );
    repository.save.mockImplementation((value: TodoEntity | TodoEntity[]) =>
      Promise.resolve(value),
    );
    manager.findOne.mockResolvedValue({ id: USER });
    service = new TodosService({
      ...repository,
      manager: { transaction },
    } as unknown as Repository<TodoEntity>);
  });
  it('scopes reads by owner', async () => {
    await service.findAll(USER);
    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: USER },
      order: { id: 'ASC' },
    });
  });
  it('returns 404 for a missing owned Todo', async () => {
    await expect(service.findOne(USER, 999)).rejects.toThrow(NotFoundException);
  });
  it('creates roots without changing existing Todo properties', async () => {
    const created = await service.create(USER, { title: 'Root' });
    expect(created).toMatchObject({
      parentId: null,
      completed: false,
      isFixed: false,
      scheduledAt: null,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects a fixed Todo without a date', async () => {
    await expect(
      service.create(USER, { title: 'Fixed', isFixed: true }),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects invalid parents without saving', async () => {
    await expect(
      service.create(USER, { title: 'X', parentId: 999 }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('reopens all completed ancestors when adding a child, preserving their own fields', async () => {
    rows = [todo(1, null, true), todo(2, 1, true)];
    rows[0].plannedDurationMinutes = 60;
    rows[0].scheduledAt = new Date('2026-01-01');
    await service.create(USER, { title: 'Child', parentId: 2 });
    expect(rows.every((t) => !t.completed && t.completedAt === null)).toBe(
      true,
    );
    expect(rows[0].plannedDurationMinutes).toBe(60);
    expect(rows[0].scheduledAt).toEqual(new Date('2026-01-01'));
  });
  it('allows independent parent completion', async () => {
    rows = [todo(1), todo(2, 1)];
    await service.update(USER, 1, { completed: true });
    expect(rows[0].completed).toBe(true);
    expect(rows[1].completed).toBe(false);
    expect(rows[0].completedAt).toBeInstanceOf(Date);
  });
  it('does not autocomplete a parent', async () => {
    rows = [todo(1), todo(2, 1)];
    await service.update(USER, 2, { completed: true });
    expect(rows[0].completed).toBe(false);
  });
  it('preserves the original completion timestamp on repeated completion', async () => {
    rows = [todo(1, null, true)];
    const date = rows[0].completedAt;
    await service.update(USER, 1, { completed: true });
    expect(rows[0].completedAt).toEqual(date);
  });
  it('reopens ancestors on child reopening', async () => {
    rows = [todo(1, null, true), todo(2, 1, true)];
    await service.update(USER, 2, { completed: false });
    expect(rows.every((t) => !t.completed && t.completedAt === null)).toBe(
      true,
    );
  });
  it('detects open descendants when moving an explicitly completed root', async () => {
    rows = [todo(1, null, true), todo(2, null, true), todo(3, 2, false)];
    await service.update(USER, 2, { parentId: 1 });
    expect(rows[0].completed).toBe(false);
    expect(rows[1].completed).toBe(true);
    expect(rows[2].parentId).toBe(2);
  });
  it('rejects cycles and self-parenting before save', async () => {
    rows = [todo(1), todo(2, 1)];
    await expect(service.update(USER, 1, { parentId: 2 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(USER, 1, { parentId: 1 })).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('moves to root while retaining own properties', async () => {
    rows = [todo(1), todo(2, 1)];
    rows[1].plannedDurationMinutes = 30;
    await service.update(USER, 2, { parentId: null });
    expect(rows[1]).toMatchObject({
      parentId: null,
      plannedDurationMinutes: 30,
    });
  });
  it('rejects empty updates and invalid fixed schedules', async () => {
    await expect(service.update(USER, 1, {})).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(USER, 1, { isFixed: true })).rejects.toThrow(
      BadRequestException,
    );
  });
});
