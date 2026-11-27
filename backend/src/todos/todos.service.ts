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
import { assertOwnedCategory, normalizeWhy } from '../categories/assignment';
import { Clock } from '../common/clock';
import { assertDateOnly } from '../common/date/date-only.utils';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  discardTimersOfTodos,
  hasOpenTimer,
  releaseTimers,
  timersOfTodos,
} from '../timers/timer-target';
import { TimerEntity } from '../timers/timer.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { RescheduleTodoDto } from './dto/reschedule-todo.dto';
import {
  DeletionPreviewResponse,
  HierarchyTodoResponse,
} from './dto/todo-hierarchy-response.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { TodoMapper } from './mappers/todo.mapper';
import { assertGoalAvailable, assertGoalShape, habitGoals } from './habit-goal';
import { assertCampaignFields, NO_CAMPAIGN_FIELDS } from './campaign-style';
import { backlogTodos } from './todo-agenda';
import { inProgressTodoIds } from './campaign-board';
import { cleanNotes, InvalidNotesError, NotesDocument } from './todo-notes';
import {
  CorruptHierarchyError,
  InvalidPlacementError,
  TodoTree,
} from './todo-hierarchy';
import { ancestorChain, subtree } from './todo-hierarchy.queries';
import { loadTodoAncestry, TodoAncestry } from './todo-ancestry';
import {
  assertQuestPlan,
  firstBacklogPosition,
  nextBacklogPosition,
  saveQuest,
} from './quest-commands';

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

  /** What the user's todos inherit their reason from, as of now. */
  ancestry(userId: string): Promise<TodoAncestry> {
    return loadTodoAncestry(
      this.todoRepository.manager,
      userId,
      this.clock.today(),
    );
  }

  findAll(userId: string): Promise<TodoEntity[]> {
    return this.todoRepository.find({
      where: { userId },
      order: { id: 'ASC' },
    });
  }

  /** Open todos without a day that one can work on: the Questlog, in its order. */
  backlog(userId: string): Promise<TodoEntity[]> {
    return backlogTodos(this.todoRepository.manager, userId);
  }

  /**
   * Stores the order the user sorted the Questlog into: the given quests
   * first, in that order, then every other quest of the Questlog in the
   * order it had. Nothing is written unless every id is one of the user's
   * quests in the Questlog.
   */
  async reorderBacklog(userId: string, ids: number[]): Promise<void> {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Every quest may appear only once');
    return this.unitOfWork.run(userId, async (manager) => {
      const backlog = await backlogTodos(manager, userId);
      const byId = new Map(backlog.map((todo) => [todo.id, todo]));
      if (ids.some((id) => !byId.has(id)))
        throw new NotFoundException('A quest to sort is not in the Questlog');
      const listed = new Set(ids);
      const order = [
        ...ids.map((id) => byId.get(id)!),
        ...backlog.filter((todo) => !listed.has(todo.id)),
      ];
      const repository = manager.getRepository(TodoEntity);
      for (const [backlogPosition, todo] of order.entries())
        if (todo.backlogPosition !== backlogPosition)
          await repository.update({ id: todo.id, userId }, { backlogPosition });
    });
  }

  async findOne(userId: string, id: number): Promise<TodoEntity> {
    const todo = await this.todoRepository.findOneBy({ id, userId });
    if (!todo) throw new NotFoundException(`Todo with ID ${id} was not found`);
    return todo;
  }

  /** The notes of one owned todo; they are loaded only here. */
  async notes(userId: string, id: number): Promise<NotesDocument | null> {
    const todo = await this.todoRepository.findOne({
      select: { id: true, notes: true },
      where: { id, userId },
    });
    if (!todo) throw new NotFoundException(`Todo with ID ${id} was not found`);
    return todo.notes ?? null;
  }

  /** Stores the notes reduced to what the editor can show. */
  setNotes(
    userId: string,
    id: number,
    input: unknown,
  ): Promise<NotesDocument | null> {
    let notes: NotesDocument | null;
    try {
      notes = cleanNotes(input);
    } catch (error) {
      if (error instanceof InvalidNotesError)
        throw new BadRequestException(error.message);
      throw error;
    }
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      todo.notes = notes;
      await repository.save(todo);
      return notes;
    });
  }

  /** Every todo with its subtree progress, from one consistent read. */
  async hierarchy(userId: string): Promise<HierarchyTodoResponse[]> {
    const todos = await this.findAll(userId);
    const progress = this.tree(todos).progress();
    const manager = this.todoRepository.manager;
    const [goals, ancestry, inProgress] = await Promise.all([
      habitGoals(manager, todos),
      this.ancestry(userId),
      inProgressTodoIds(manager, userId, todos),
    ]);
    return todos.map((todo) => ({
      ...TodoMapper.toResponseDto(todo, ancestry),
      progress: progress.get(todo.id)!,
      habitGoal: goals.get(todo.id) ?? null,
      inProgress: inProgress.has(todo.id),
    }));
  }

  async create(userId: string, dto: CreateTodoDto): Promise<TodoEntity> {
    const scheduledDate = dto.scheduledDate ?? null;
    const timeOfDay = dto.timeOfDay ?? null;
    assertQuestPlan(scheduledDate, timeOfDay);
    const parentId = dto.parentId ?? null;
    const campaign = {
      weeklyTargetMinutes: dto.weeklyTargetMinutes ?? null,
      color: dto.color ?? null,
      icon: dto.icon ?? null,
    };
    assertCampaignFields({ parentId, ...campaign });
    return this.unitOfWork.run(userId, async (manager) => {
      await this.assertCanPlace(manager, userId, null, parentId);
      const repository = manager.getRepository(TodoEntity);
      const categoryId =
        dto.categoryId !== undefined
          ? dto.categoryId
          : await this.parentCategory(manager, userId, parentId);
      await assertOwnedCategory(manager, userId, categoryId);
      return repository.save(
        repository.create({
          userId,
          parentId,
          categoryId,
          why: normalizeWhy(dto.why),
          title: dto.title,
          completed: false,
          completedAt: null,
          scheduledDate,
          timeOfDay,
          backlogPosition:
            scheduledDate === null
              ? dto.backlogPlace === 'top'
                ? await firstBacklogPosition(manager, userId)
                : await nextBacklogPosition(manager, userId)
              : null,
          plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
          focusBlock: dto.focusBlock ?? 'default',
          ...campaign,
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
        // Below another todo it is no campaign any more.
        if (dto.parentId !== null) Object.assign(todo, NO_CAMPAIGN_FIELDS);
      }
      if (dto.weeklyTargetMinutes !== undefined)
        todo.weeklyTargetMinutes = dto.weeklyTargetMinutes;
      if (dto.color !== undefined) todo.color = dto.color;
      if (dto.icon !== undefined) todo.icon = dto.icon;
      assertCampaignFields(todo);
      if (dto.categoryId !== undefined) {
        await assertOwnedCategory(manager, userId, dto.categoryId);
        todo.categoryId = dto.categoryId;
      }
      if (dto.why !== undefined) todo.why = normalizeWhy(dto.why);
      if (dto.periodStart !== undefined) todo.periodStart = dto.periodStart;
      if (dto.periodEnd !== undefined) todo.periodEnd = dto.periodEnd;
      if (dto.goalHabitId !== undefined) todo.goalHabitId = dto.goalHabitId;
      if (dto.goalTarget !== undefined) todo.goalTarget = dto.goalTarget;
      assertGoalShape({
        periodStart: todo.periodStart ?? null,
        periodEnd: todo.periodEnd ?? null,
        goalHabitId: todo.goalHabitId ?? null,
        goalTarget: todo.goalTarget ?? null,
      });
      await assertGoalAvailable(manager, userId, todo);
      if (dto.title !== undefined) todo.title = dto.title;
      if (dto.plannedDurationMinutes !== undefined)
        todo.plannedDurationMinutes = dto.plannedDurationMinutes;
      if (dto.focusBlock !== undefined) todo.focusBlock = dto.focusBlock;
      if (dto.blocked !== undefined) {
        if (dto.blocked && (dto.completed ?? todo.completed))
          throw new ConflictException(
            'Erledigte Quests können nicht geblockt werden.',
          );
        todo.blocked = dto.blocked;
      }
      return saveQuest(
        manager,
        todo,
        {
          scheduledDate: dto.scheduledDate,
          timeOfDay: dto.timeOfDay,
          completed: dto.completed,
        },
        this.clock.now(),
      );
    });
  }

  /** Moves an open todo to another day; an appointment keeps its time. */
  async reschedule(
    userId: string,
    id: number,
    dto: RescheduleTodoDto,
  ): Promise<TodoEntity> {
    assertDateOnly(dto.date);
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      if (todo.completed)
        throw new ConflictException(
          'Erledigte Quests können nicht verschoben werden.',
        );
      if (!todo.scheduledDate)
        throw new BadRequestException('Die Quest hat noch keinen Termin.');
      if (dto.date < this.clock.today())
        throw new BadRequestException(
          'Quests können nicht in die Vergangenheit verschoben werden.',
        );
      if (todo.timeOfDay && !dto.confirmFixed)
        throw new ConflictException(
          'Feste Termine müssen ausdrücklich bestätigt werden.',
        );
      if (await hasOpenTimer(manager, userId, { todoId: id }))
        throw new ConflictException(
          'Beende zuerst die Stoppuhr, bevor du die Quest verschiebst.',
        );
      return saveQuest(
        manager,
        todo,
        { scheduledDate: dto.date },
        this.clock.now(),
      );
    });
  }

  /**
   * Puts an open quest back out of "In Arbeit" (campaign-board.md): from
   * now on only new work counts, its stopwatch ends with its work logged,
   * and `blocked` says whether it waits on something.
   */
  async setAside(
    userId: string,
    id: number,
    blocked: boolean,
  ): Promise<TodoEntity> {
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      if (todo.completed)
        throw new ConflictException(
          'Erledigte Quests können nicht zurückgelegt werden.',
        );
      const now = this.clock.now();
      await releaseTimers(manager, userId, { todoIds: [id] }, now);
      todo.setAsideAt = now;
      todo.blocked = blocked;
      return repository.save(todo);
    });
  }

  /**
   * Takes an open quest into "In Arbeit" by hand, without a stopwatch, so
   * several can be in progress at once. It lifts "Geblockt" like starting
   * a stopwatch does.
   */
  async startWork(userId: string, id: number): Promise<TodoEntity> {
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      if (todo.completed)
        throw new ConflictException(
          'Erledigte Quests können nicht in Arbeit genommen werden.',
        );
      todo.startedAt = this.clock.now();
      todo.blocked = false;
      return repository.save(todo);
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
      await discardTimersOfTodos(manager, userId, ids, this.clock.now());
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

  /** A new child starts in its parent's category; there is no live inheritance. */
  private async parentCategory(
    manager: EntityManager,
    userId: string,
    parentId: number | null,
  ): Promise<number | null> {
    if (parentId === null) return null;
    const parent = await manager
      .getRepository(TodoEntity)
      .findOneBy({ id: parentId, userId });
    return parent?.categoryId ?? null;
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
}
