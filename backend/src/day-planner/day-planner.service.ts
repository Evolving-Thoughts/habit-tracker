import { Injectable } from '@nestjs/common';
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
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { coveredMilliseconds } from '../work-logs/work-time';
import {
  completedTodos,
  openScheduledTodos,
  placeOpenTodo,
} from '../todos/todo-agenda';
import {
  DayPlannerGoalDto,
  DayPlannerHabitItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';

/** Fields filled after mapping, from lookups across all items. */
type ContextField = 'categoryName' | 'why' | 'goal' | 'workedMinutes';

const minutes = (milliseconds: number): number =>
  Math.round(milliseconds / 60_000);

@Injectable()
export class DayPlannerService {
  constructor(
    private readonly db: DataSource,
    private readonly scheduling: HabitSchedulingService,
    private readonly clock: Clock,
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

    const [parents, habitGoalsByHabit, logs] = await Promise.all([
      this.parentsOf(userId, todos),
      this.habitGoalsFor(
        userId,
        occurrences.map((occurrence) => occurrence.habitId),
        today,
      ),
      this.logsOf(userId, today),
    ]);
    const workedOn = (key: 'todoId' | 'occurrenceId', id: number): number =>
      minutes(coveredMilliseconds(logs.filter((log) => log[key] === id)));

    const items = [
      ...todos.map((todo) => {
        const parent =
          todo.parentId === null ? undefined : parents.get(todo.parentId);
        return {
          ...this.mapTodo(todo, today),
          categoryName: categoryName(todo.categoryId),
          why: todo.why ?? null,
          goal: parent
            ? { title: parent, completed: null, target: null, periodEnd: null }
            : null,
          workedMinutes: workedOn('todoId', todo.id),
        };
      }),
      ...occurrences.map((occurrence) => ({
        ...this.mapOccurrence(occurrence, today),
        categoryName: categoryName(occurrence.habit.categoryId),
        why: occurrence.habit.why ?? null,
        goal: habitGoalsByHabit.get(occurrence.habitId) ?? null,
        workedMinutes: workedOn('occurrenceId', occurrence.id),
      })),
    ];

    items.sort((first, second) => {
      const dateComparison = first.scheduledDate.localeCompare(
        second.scheduledDate,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const firstTime =
        first.type === 'todo'
          ? (first.scheduledAt ??
            first.completedAt ??
            `${first.scheduledDate}T00:00:00Z`)
          : `${first.scheduledDate}T00:00:00.000Z`;

      const secondTime =
        second.type === 'todo'
          ? (second.scheduledAt ??
            second.completedAt ??
            `${second.scheduledDate}T00:00:00Z`)
          : `${second.scheduledDate}T00:00:00.000Z`;

      return firstTime.localeCompare(secondTime);
    });

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
    const displayInstant = todo.scheduledAt ?? todo.completedAt;
    if (!displayInstant)
      throw new Error('Expected a planned or completed todo');

    const scheduledDate = placement?.scheduledDate ?? dayOf(displayInstant);

    return {
      type: 'todo',
      todoId: todo.id,
      title: todo.title,
      status: todo.completed ? 'completed' : 'pending',
      scheduledDate,
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
      completedAt: todo.completedAt?.toISOString() ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      isFixed: todo.isFixed,
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
