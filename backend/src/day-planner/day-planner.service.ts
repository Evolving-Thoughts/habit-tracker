import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Between,
  DataSource,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { eventsOfDays } from '../calendar/day-events';
import { CategoryEntity } from '../categories/category.entity';
import { dayOf, endOfDay, startOfDay } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import {
  effectiveDuration,
  isOccurrenceTimerEligible,
  isTodoTimerEligible,
} from '../timers/timer-target';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import {
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { lastMovableDate } from '../habits/scheduling/schedule-rules';
import { TodoEntity } from '../todos/entities/todo.entity';
import { habitGoals } from '../todos/habit-goal';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { coveredMilliseconds } from '../work-logs/work-time';
import {
  completedTodos,
  openScheduledTodos,
  placeOpenTodo,
} from '../todos/todo-agenda';
import { compareInDay } from './day-order';
import {
  DayPlannerGoalDto,
  DayPlannerHabitItemDto,
  DayPlannerItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';

/** Fields filled after mapping, from lookups across all items. */
type ContextField =
  'categoryName' | 'why' | 'goal' | 'campaign' | 'workedMinutes';

const minutes = (milliseconds: number): number =>
  Math.round(milliseconds / 60_000);

@Injectable()
export class DayPlannerService {
  constructor(
    private readonly db: DataSource,
    private readonly scheduling: HabitSchedulingService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  async getToday(userId: string): Promise<DayPlannerResponseDto> {
    const today = this.clock.today();

    const [todos, occurrences, categories] = await Promise.all([
      this.findTodosForToday(userId, today),
      this.scheduling.getToday(userId),
      this.db.getRepository(CategoryEntity).findBy({ userId }),
    ]);
    const names = new Map(categories.map((item) => [item.id, item.name]));
    const categoryName = (id: number | null): string | null =>
      (id !== null && names.get(id)) || null;

    const [parents, habitGoalsByHabit, logs, ancestry] = await Promise.all([
      this.parentsOf(userId, todos),
      this.habitGoalsFor(
        userId,
        occurrences.map((occurrence) => occurrence.habitId),
        today,
      ),
      this.logsOf(userId, today),
      loadTodoAncestry(this.db.manager, userId, today),
    ]);
    const workedOn = (key: 'todoId' | 'occurrenceId', id: number): number =>
      minutes(coveredMilliseconds(logs.filter((log) => log[key] === id)));

    const entries = [
      ...todos.map((todo) => {
        const parent =
          todo.parentId === null ? undefined : parents.get(todo.parentId);
        const item: DayPlannerItemDto = {
          ...this.mapTodo(todo, today),
          categoryName: categoryName(todo.categoryId),
          why: ancestry.todoWhy(todo),
          goal: parent
            ? { title: parent, completed: null, target: null, periodEnd: null }
            : null,
          campaign: ancestry.campaignOf(todo),
          workedMinutes: workedOn('todoId', todo.id),
        };
        return { item, id: todo.id, dayPosition: todo.dayPosition };
      }),
      ...occurrences.map((occurrence) => {
        const item: DayPlannerItemDto = {
          ...this.mapOccurrence(occurrence, today),
          categoryName: categoryName(occurrence.habit.categoryId),
          why: ancestry.habitWhy(occurrence.habit),
          goal: habitGoalsByHabit.get(occurrence.habitId) ?? null,
          campaign: ancestry.habitCampaign(occurrence.habitId),
          workedMinutes: workedOn('occurrenceId', occurrence.id),
        };
        return { item, id: occurrence.id, dayPosition: occurrence.dayPosition };
      }),
    ];
    const items = entries
      .sort((first, second) =>
        compareInDay(
          { ...first, ...first.item },
          { ...second, ...second.item },
        ),
      )
      .map(({ item }) => item);

    const externalEvents = await eventsOfDays(
      this.db.manager,
      { userId },
      today,
    );
    return new DayPlannerResponseDto({
      date: today,
      items,
      externalEvents: externalEvents.map(({ id, title, start, end }) => ({
        id,
        title,
        start: start.toISOString(),
        end: end.toISOString(),
      })),
      workedMinutes: minutes(coveredMilliseconds(logs)),
    });
  }

  /**
   * Stores the order the user sorted a day into: every item takes its index
   * as position. Nothing is written unless all items are the user's own.
   */
  reorder(
    userId: string,
    items: { type: 'todo' | 'habit'; id: number }[],
  ): Promise<void> {
    const idsOf = (type: 'todo' | 'habit'): number[] => [
      ...new Set(
        items.filter((item) => item.type === type).map(({ id }) => id),
      ),
    ];
    const todoIds = idsOf('todo');
    const occurrenceIds = idsOf('habit');
    return this.unitOfWork.run(userId, async (manager) => {
      const [todos, occurrences] = await Promise.all([
        todoIds.length
          ? manager
              .getRepository(TodoEntity)
              .countBy({ userId, id: In(todoIds) })
          : 0,
        occurrenceIds.length
          ? ownedOccurrences(manager, userId)
              .andWhere('"occurrence"."id" IN (:...occurrenceIds)', {
                occurrenceIds,
              })
              .getCount()
          : 0,
      ]);
      if (todos !== todoIds.length || occurrences !== occurrenceIds.length)
        throw new NotFoundException('An item to sort was not found');
      for (const [dayPosition, { type, id }] of items.entries())
        await manager
          .getRepository(type === 'todo' ? TodoEntity : HabitOccurrenceEntity)
          .update({ id }, { dayPosition });
    });
  }

  /** Titles of the direct parents: the goal a todo is a step towards. */
  private async parentsOf(
    userId: string,
    todos: TodoEntity[],
  ): Promise<Map<number, string>> {
    const ids = [
      ...new Set(
        todos.flatMap((todo) =>
          todo.parentId === null ? [] : [todo.parentId],
        ),
      ),
    ];
    if (!ids.length) return new Map();
    const parents = await this.db.getRepository(TodoEntity).find({
      select: { id: true, title: true },
      where: { userId, id: In(ids) },
    });
    return new Map(parents.map((parent) => [parent.id, parent.title]));
  }

  /** The goal each habit counts towards in a period covering today. */
  private async habitGoalsFor(
    userId: string,
    habitIds: number[],
    today: string,
  ): Promise<Map<number, DayPlannerGoalDto>> {
    if (!habitIds.length) return new Map();
    const goals = await this.db.getRepository(TodoEntity).find({
      where: {
        userId,
        goalHabitId: In([...new Set(habitIds)]),
        periodStart: LessThanOrEqual(today),
        periodEnd: MoreThanOrEqual(today),
      },
    });
    const progress = await habitGoals(this.db.manager, goals);
    const result = new Map<number, DayPlannerGoalDto>();
    for (const goal of goals) {
      const counted = progress.get(goal.id);
      if (!counted) continue;
      result.set(counted.habitId, {
        title: goal.title,
        completed: counted.completed,
        target: counted.target,
        periodEnd: goal.periodEnd,
      });
    }
    return result;
  }

  /** Logs belong to the day they started on, as in the work log. */
  private logsOf(userId: string, today: string): Promise<WorkLogEntity[]> {
    return this.db.getRepository(WorkLogEntity).find({
      where: {
        userId,
        startedAt: Between(
          startOfDay(today),
          new Date(endOfDay(today).getTime() - 1),
        ),
      },
    });
  }

  private async findTodosForToday(
    userId: string,
    today: string,
  ): Promise<TodoEntity[]> {
    const day = { firstDay: today, lastDay: today };
    const [open, completed] = await Promise.all([
      openScheduledTodos(this.db.manager, userId, {
        ...day,
        includeOverdue: true,
      }),
      completedTodos(this.db.manager, userId, day),
    ]);
    return [...open, ...completed];
  }

  private mapTodo(
    todo: TodoEntity,
    today: string,
  ): Omit<DayPlannerTodoItemDto, ContextField> {
    // Open todos follow the agenda; completed ones stay on their own day.
    const placement = todo.completed ? null : placeOpenTodo(todo, today);
    const scheduledDate =
      placement?.scheduledDate ??
      todo.scheduledDate ??
      (todo.completedAt ? dayOf(todo.completedAt) : null);
    if (!scheduledDate) throw new Error('Expected a planned or completed todo');

    return {
      type: 'todo',
      todoId: todo.id,
      title: todo.title,
      status: todo.completed ? 'completed' : 'pending',
      scheduledDate,
      timeOfDay: todo.timeOfDay ?? null,
      completedAt: todo.completedAt?.toISOString() ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      isOverdue: placement?.isOverdue ?? false,
      timerEligible: isTodoTimerEligible(todo),
    };
  }

  private mapOccurrence(
    occurrence: HabitOccurrenceEntity,
    today: string,
  ): Omit<DayPlannerHabitItemDto, ContextField> {
    if (!occurrence.habit || !occurrence.scheduleVersion) {
      throw new Error('Missing occurrence relations');
    }

    const pending = occurrence.status === HabitOccurrenceStatus.PENDING;
    const dueDate = occurrenceDueDate(occurrence);

    return {
      type: 'habit',
      plannedDurationMinutes: effectiveDuration(occurrence, occurrence.habit),
      timeOfDay: occurrence.habit.timeOfDay ?? null,
      occurrenceId: occurrence.id,
      habitId: occurrence.habitId,
      title: occurrence.habit.title,
      status: occurrence.status,
      scheduledDate: pending ? dueDate : occurrence.scheduledDate,
      moveUntil: pending
        ? lastMovableDate(occurrence.scheduleVersion, occurrence.scheduledDate)
        : null,
      scheduleType: occurrence.scheduleVersion.type,
      isOverdue: pending && dueDate < today,
      timerEligible: isOccurrenceTimerEligible(
        occurrence,
        occurrence.habit,
        today,
      ),
    };
  }
}
