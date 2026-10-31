import { Injectable } from '@nestjs/common';
import { Between, DataSource } from 'typeorm';
import { ExternalEventEntity } from '../calendar/calendar.entities';
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
import {
  completedTodos,
  openScheduledTodos,
  placeOpenTodo,
} from '../todos/todo-agenda';
import {
  DayPlannerHabitItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';

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

    const items = [
      ...todos.map((todo) => ({
        ...this.mapTodo(todo, today),
        categoryName: categoryName(todo.categoryId),
      })),
      ...occurrences.map((occurrence) => ({
        ...this.mapOccurrence(occurrence, today),
        categoryName: categoryName(occurrence.habit.categoryId),
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

    const externalEvents = await this.db
      .getRepository(ExternalEventEntity)
      .find({
        where: {
          userId,
          start: Between(startOfDay(today), endOfDay(today)),
        },
        order: { start: 'ASC' },
      });
    return new DayPlannerResponseDto({
      date: today,
      items,
      externalEvents: externalEvents.map(({ id, title, start, end }) => ({
        id,
        title,
        start: start.toISOString(),
        end: end.toISOString(),
      })),
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
  ): Omit<DayPlannerTodoItemDto, 'categoryName'> {
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
  ): Omit<DayPlannerHabitItemDto, 'categoryName'> {
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
