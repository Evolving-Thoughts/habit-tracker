import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  discardTimersOfTodos,
  releaseTimers,
  timersOfTodos,
} from '../timers/timer-target';
import { TimerEntity } from '../timers/timer.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import {
  DeletionPreviewResponse,
  HierarchyTodoResponse,
} from './dto/todo-hierarchy-response.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { TodoMapper } from './mappers/todo.mapper';
import { backlogTodos } from './todo-agenda';
import {
  CorruptHierarchyError,
  InvalidPlacementError,
  TodoTree,
} from './todo-hierarchy';
import { ancestorChain, subtree } from './todo-hierarchy.queries';

type DeletionSnapshot = {
  todos: TodoEntity[];
  timers: TimerEntity[];
  confirmationToken: string;
};

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  findAll(userId: string): Promise<TodoEntity[]> {
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

  /** Every todo with its subtree progress, from one consistent read. */
  async hierarchy(userId: string): Promise<HierarchyTodoResponse[]> {
    const todos = await this.findAll(userId);
    const progress = this.tree(todos).progress();
    return todos.map((todo) => ({
      ...TodoMapper.toResponseDto(todo),
      progress: progress.get(todo.id)!,
    }));
  }

  async create(userId: string, dto: CreateTodoDto): Promise<TodoEntity> {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const isFixed = dto.isFixed ?? false;
    this.validateScheduling(isFixed, scheduledAt);
    const parentId = dto.parentId ?? null;
    return this.unitOfWork.run(userId, async (manager) => {
      await this.assertCanPlace(manager, userId, null, parentId);
      const repository = manager.getRepository(TodoEntity);
      return repository.save(
        repository.create({
          userId,
          parentId,
          title: dto.title,
          completed: false,
          completedAt: null,
          scheduledAt,
          plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
          isFixed,
        }),
      );
    });
  }

  async update(
    userId: string,
    id: number,
    dto: UpdateTodoDto,
  ): Promise<TodoEntity> {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('At least one property must be provided');
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      if (dto.parentId !== undefined && dto.parentId !== todo.parentId) {
        await this.assertCanPlace(manager, userId, id, dto.parentId);
        todo.parentId = dto.parentId;
      }
      if (dto.title !== undefined) todo.title = dto.title;
      if (dto.scheduledAt !== undefined)
        todo.scheduledAt =
          dto.scheduledAt === null ? null : new Date(dto.scheduledAt);
      if (dto.plannedDurationMinutes !== undefined)
        todo.plannedDurationMinutes = dto.plannedDurationMinutes;
      if (dto.isFixed !== undefined) todo.isFixed = dto.isFixed;
      if (dto.completed !== undefined) {
        todo.completed = dto.completed;
        // A repeated completion keeps the original timestamp.
        if (dto.completed) todo.completedAt ??= this.clock.now();
        else todo.completedAt = null;
      }
      this.validateScheduling(todo.isFixed, todo.scheduledAt);
      const saved = await repository.save(todo);
      // A completed todo is no timer target any more.
      if (todo.completed)
        await releaseTimers(manager, userId, { todoIds: [id] });
      return saved;
    });
  }

  async deletionPreview(
    userId: string,
    id: number,
  ): Promise<DeletionPreviewResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const snapshot = await this.deletionSnapshot(manager, userId, id);
      return {
        confirmationToken: snapshot.confirmationToken,
        todos: snapshot.todos.map((t) => ({
          id: t.id,
          title: t.title,
          parentId: t.parentId ?? null,
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

  /**
   * Deletes the todo with its whole subtree and their timers, but only if
   * nothing changed since the preview that issued `confirmationToken`.
   * Soft delete keeps completion history; it all happens in one transaction.
   */
  async remove(
    userId: string,
    id: number,
    confirmationToken: string,
  ): Promise<void> {
    await this.unitOfWork.run(userId, async (manager) => {
      const snapshot = await this.deletionSnapshot(manager, userId, id);
      if (confirmationToken !== snapshot.confirmationToken)
        throw new ConflictException(
          'Deletion preview changed. Review the preview again.',
        );
      const ids = snapshot.todos.map((t) => t.id);
      await discardTimersOfTodos(manager, userId, ids);
      await manager
        .getRepository(TodoEntity)
        .createQueryBuilder()
        .softDelete()
        .where('"userId" = :userId', { userId })
        .andWhere('"id" = ANY(:ids)', { ids })
        .execute();
    });
  }

  private async deletionSnapshot(
    manager: EntityManager,
    userId: string,
    id: number,
  ): Promise<DeletionSnapshot> {
    const todos = await subtree(manager, userId, id);
    if (!todos.length)
      throw new NotFoundException(`Todo with ID ${id} was not found`);
    const timers = await timersOfTodos(
      manager,
      userId,
      todos.map((t) => t.id),
    );
    // updatedAt changes with every edit, so it fingerprints each row.
    const confirmationToken = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          id,
          todos: todos.map((t) => [t.id, t.parentId, t.updatedAt]),
          timers: timers.map((t) => [t.id, t.state, t.updatedAt]),
        }),
      )
      .digest('hex');
    return { todos, timers, confirmationToken };
  }

  /** Validates a placement against the parent's live ancestor chain. */
  private async assertCanPlace(
    manager: EntityManager,
    userId: string,
    id: number | null,
    parentId: number | null,
  ): Promise<void> {
    if (parentId === null) return;
    const chain = await ancestorChain(manager, userId, parentId);
    try {
      this.tree(chain).assertCanPlace(id, parentId);
    } catch (error) {
      if (error instanceof InvalidPlacementError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  private tree(todos: TodoEntity[]): TodoTree<TodoEntity> {
    try {
      return TodoTree.of(todos);
    } catch (error) {
      // A cycle in stored data is our fault, not the client's.
      if (error instanceof CorruptHierarchyError)
        throw new InternalServerErrorException(error.message);
      throw error;
    }
  }

  private validateScheduling(isFixed: boolean, scheduledAt: Date | null): void {
    if (isFixed && scheduledAt === null)
      throw new BadRequestException('A fixed todo requires a scheduled date');
  }
}
