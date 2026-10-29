import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { TimerEntity } from '../timers/timer.entity';
import { UserEntity } from '../auth/auth.entities';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { TodoMapper } from './mappers/todo.mapper';
import { hierarchyProgress, validateParent } from './todo-hierarchy';
import { backlogTodos } from './todo-agenda';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
  ) {}

  async findAll(userId: string): Promise<TodoEntity[]> {
    return this.todoRepository.find({
      where: { userId },
      order: { id: 'ASC' },
    });
  }
  /** Open todos without a date (Todo-Dump). */
  backlog(userId: string): Promise<TodoEntity[]> {
    return backlogTodos(this.todoRepository.manager, userId);
  }
  async findOne(userId: string, id: number): Promise<TodoEntity> {
    const todo = await this.todoRepository.findOneBy({ id, userId });
    if (!todo) throw new NotFoundException(`Todo with ID ${id} was not found`);
    return todo;
  }
  async hierarchy(userId: string) {
    // One statement returns a coherent tree snapshot; compute all progress bottom-up.
    const todos = await this.findAll(userId);
    const progress = hierarchyProgress(todos);
    return todos.map((todo) => ({
      ...TodoMapper.toResponseDto(todo),
      progress: progress.get(todo.id)!,
    }));
  }
  private async transaction<T>(
    userId: string,
    operation: (
      repository: Repository<TodoEntity>,
      manager: EntityManager,
    ) => Promise<T>,
  ): Promise<T> {
    return this.todoRepository.manager.transaction(async (manager) => {
      // Same lock order as TimersService: user row first, then owned todos.
      const user = await manager.findOne(UserEntity, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException();
      return operation(manager.getRepository(TodoEntity), manager);
    });
  }
  private async reopenAncestors(
    repository: Repository<TodoEntity>,
    todos: TodoEntity[],
    parentId: number | null,
  ): Promise<void> {
    const byId = new Map(todos.map((t) => [t.id, t]));
    const changed: TodoEntity[] = [],
      seen = new Set<number>();
    let current = parentId;
    while (current !== null) {
      if (seen.has(current))
        throw new ConflictException('Invalid todo hierarchy');
      seen.add(current);
      const parent = byId.get(current);
      if (!parent) throw new ConflictException('Invalid todo hierarchy');
      if (parent.completed || parent.completedAt !== null) {
        parent.completed = false;
        parent.completedAt = null;
        changed.push(parent);
      }
      current = parent.parentId ?? null;
    }
    if (changed.length) await repository.save(changed, { chunk: 500 });
  }
  async create(userId: string, dto: CreateTodoDto): Promise<TodoEntity> {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isFixed = dto.isFixed ?? false;
    this.validateScheduling(isFixed, scheduledAt);
    return this.transaction(userId, async (repository) => {
      const todos = await repository.find({ where: { userId } });
      validateParent(todos, -1, dto.parentId ?? null);
      const todo = repository.create({
        userId,
        title: dto.title,
        parentId: dto.parentId ?? null,
        completed: false,
        completedAt: null,
        scheduledAt,
        plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
        isFixed,
      });
      const saved = await repository.save(todo);
      await this.reopenAncestors(repository, todos, saved.parentId);
      return saved;
    });
  }
  async update(
    userId: string,
    id: number,
    dto: UpdateTodoDto,
  ): Promise<TodoEntity> {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('At least one property must be provided');
    return this.transaction(userId, async (repository) => {
      const todos = await repository.find({ where: { userId } });
      const todo = todos.find((t) => t.id === id);
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      const oldParent = todo.parentId ?? null;
      const wasCompleted = todo.completed;
      const parent = dto.parentId === undefined ? oldParent : dto.parentId;
      validateParent(todos, id, parent);
      if (dto.title !== undefined) todo.title = dto.title;
      if (dto.scheduledAt !== undefined)
        todo.scheduledAt =
          dto.scheduledAt === null ? null : new Date(dto.scheduledAt);
      if (dto.plannedDurationMinutes !== undefined)
        todo.plannedDurationMinutes = dto.plannedDurationMinutes;
      if (dto.isFixed !== undefined) todo.isFixed = dto.isFixed;
      if (dto.completed !== undefined) {
        todo.completed = dto.completed;
        if (dto.completed) todo.completedAt ??= new Date();
        else todo.completedAt = null;
      }
      todo.parentId = parent;
      this.validateScheduling(todo.isFixed, todo.scheduledAt);
      const children = new Map<number, TodoEntity[]>();
      for (const node of todos)
        if (node.parentId != null) {
          const group = children.get(node.parentId) ?? [];
          group.push(node);
          children.set(node.parentId, group);
        }
      let subtreeOpen = false;
      const stack = [todo],
        seen = new Set<number>();
      while (stack.length) {
        const node = stack.pop()!;
        if (seen.has(node.id))
          throw new ConflictException('Invalid todo hierarchy');
        seen.add(node.id);
        if (!node.completed) subtreeOpen = true;
        for (const child of children.get(node.id) ?? []) stack.push(child);
      }
      const saved = await repository.save(todo);
      if (
        (wasCompleted && dto.completed === false) ||
        (parent !== oldParent && subtreeOpen)
      )
        await this.reopenAncestors(repository, todos, parent);
      return saved;
    });
  }
  private async deletionSnapshot(
    userId: string,
    id: number,
    repository: Repository<TodoEntity>,
    manager: EntityManager,
  ) {
    const todos = await repository.find({
      where: { userId },
      order: { id: 'ASC' },
    });
    const root = todos.find((t) => t.id === id);
    if (!root) throw new NotFoundException(`Todo with ID ${id} was not found`);
    const children = new Map<number, TodoEntity[]>();
    for (const node of todos)
      if (node.parentId != null) {
        const group = children.get(node.parentId) ?? [];
        group.push(node);
        children.set(node.parentId, group);
      }
    const stack = [root],
      items: TodoEntity[] = [],
      seen = new Set<number>();
    while (stack.length) {
      const node = stack.pop()!;
      if (seen.has(node.id))
        throw new ConflictException('Invalid todo hierarchy');
      seen.add(node.id);
      items.push(node);
      for (const child of children.get(node.id) ?? []) stack.push(child);
    }
    items.sort((a, b) => a.id - b.id);
    // Filter user-owned timers in memory to avoid an unbounded SQL parameter list.
    const timers = await manager
      .getRepository(TimerEntity)
      .createQueryBuilder('timer')
      .where('timer.userId = :userId', { userId })
      .orderBy('timer.id', 'ASC')
      .getMany();
    const affectedTimers = timers.filter(
      (t) => t.todoId !== null && seen.has(t.todoId),
    );
    const confirmationToken = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          id,
          items: items.map((t) => [
            t.id,
            t.parentId,
            t.title,
            t.completed,
            t.completedAt,
            t.scheduledAt,
            t.isFixed,
            t.plannedDurationMinutes,
            t.updatedAt,
          ]),
          timers: affectedTimers.map((t) => [
            t.id,
            t.title,
            t.state,
            t.endsAt,
            t.remainingMilliseconds,
            t.durationMinutes,
            t.updatedAt,
          ]),
        }),
      )
      .digest('hex');
    return { items, timers: affectedTimers, confirmationToken };
  }
  async deletionPreview(userId: string, id: number) {
    return this.transaction(userId, async (repository, manager) => {
      const snapshot = await this.deletionSnapshot(
        userId,
        id,
        repository,
        manager,
      );
      return {
        confirmationToken: snapshot.confirmationToken,
        todos: snapshot.items.map((t) => ({
          id: t.id,
          title: t.title,
          parentId: t.parentId,
          completed: t.completed,
        })),
        timers: snapshot.timers.map((t) => ({
          id: t.id,
          todoId: t.todoId!,
          title: t.title,
          state: t.state,
        })),
      };
    });
  }
  async remove(
    userId: string,
    id: number,
    confirmationToken?: string,
  ): Promise<void> {
    await this.transaction(userId, async (repository, manager) => {
      const snapshot = await this.deletionSnapshot(
        userId,
        id,
        repository,
        manager,
      );
      // Legacy single-Todo delete remains compatible only when no timer is affected.
      if (
        confirmationToken !== snapshot.confirmationToken &&
        (confirmationToken !== undefined ||
          snapshot.items.length > 1 ||
          snapshot.timers.length > 0)
      )
        throw new ConflictException(
          'Deletion preview changed or confirmation is missing. Review the preview again.',
        );
      // Bounded batches, one transaction. Preserve completedAt and all history records.
      for (let offset = 0; offset < snapshot.timers.length; offset += 500) {
        await manager.delete(TimerEntity, {
          userId,
          id: In(snapshot.timers.slice(offset, offset + 500).map((t) => t.id)),
        });
      }
      for (let offset = 0; offset < snapshot.items.length; offset += 500) {
        await repository.softDelete({
          userId,
          id: In(snapshot.items.slice(offset, offset + 500).map((t) => t.id)),
        });
      }
    });
  }
  private validateScheduling(isFixed: boolean, scheduledAt: Date | null): void {
    if (isFixed && scheduledAt === null)
      throw new BadRequestException('A fixed todo requires a scheduled date');
  }
}
