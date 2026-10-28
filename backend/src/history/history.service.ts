import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import {
  forecastSlots,
  plannedHabits,
  weeklyTargets,
} from './history-planning';
import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import {
  dayOf,
  endOfDay,
  startOfDay,
  weekRange,
} from '../common/date/local-day';
import { Clock } from '../common/clock';
import { effectiveDuration } from '../timers/timer-target';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { historyRange } from './history-range';
import {
  HistoryQueryDto,
  HistoryResponse,
  HistoryItem,
  HistoryPlannedItem,
  HistoryWeeklyTarget,
} from './history.dto';

@Injectable()
export class HistoryService {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
  ) {}
  async get(userId: string, query: HistoryQueryDto): Promise<HistoryResponse> {
    const now = this.clock.now();
    const today = dayOf(now);
    const dates = historyRange(query.date ?? today, query.view ?? 'day');
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const filter = query.filter ?? 'all';
    // Read-only snapshot: opening history never reconciles or generates occurrences.
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const todos =
        filter === 'habits'
          ? []
          : await manager
              .getRepository(TodoEntity)
              .createQueryBuilder('todo')
              .withDeleted()
              .where('"todo"."userId" = :userId', { userId })
              .andWhere('"todo"."completed" = true')
              .andWhere(
                '"todo"."completedAt" >= :start AND "todo"."completedAt" < :end',
                {
                  start: startOfDay(startDate),
                  end: endOfDay(endDate),
                },
              )
              .getMany();
      const occurrences =
        filter === 'todos'
          ? []
          : await manager
              .getRepository(HabitOccurrenceEntity)
              .createQueryBuilder('occurrence')
              .withDeleted()
              .innerJoinAndSelect('occurrence.habit', 'habit')
              .where('"habit"."userId" = :userId', { userId })
              .andWhere(
                `(
          ("occurrence"."status" = 'completed' AND "occurrence"."resolvedDate" BETWEEN :startDate AND :endDate)
          OR ("occurrence"."status" = 'skipped' AND "occurrence"."scheduledDate" BETWEEN :startDate AND :endDate)
        )`,
                { startDate, endDate },
              )
              .getMany();
      const items: HistoryItem[] = [
        ...todos.map((todo) => ({
          type: 'todo' as const,
          id: todo.id,
          habitId: null,
          title: todo.title,
          status: 'completed' as const,
          date: dayOf(todo.completedAt!),
          scheduledDate: todo.scheduledAt ? dayOf(todo.scheduledAt) : null,
          resolvedAt: todo.completedAt!.toISOString(),
          plannedDurationMinutes: todo.plannedDurationMinutes,
          deleted: todo.deletedAt !== null,
        })),
        ...occurrences.map((occurrence) => ({
          type: 'habit' as const,
          id: occurrence.id,
          habitId: occurrence.habitId,
          title: occurrence.habit.title,
          status: occurrence.status as 'completed' | 'skipped',
          date:
            occurrence.status === HabitOccurrenceStatus.COMPLETED
              ? occurrence.resolvedDate!
              : occurrence.scheduledDate,
          scheduledDate: occurrence.scheduledDate,
          resolvedAt: occurrence.resolvedAt?.toISOString() ?? null,
          plannedDurationMinutes: effectiveDuration(
            occurrence,
            occurrence.habit,
          ),
          deleted: occurrence.habit.deletedAt !== null,
        })),
      ];
      items.sort(
        (a, b) =>
          (a.resolvedAt ?? '').localeCompare(b.resolvedAt ?? '') ||
          a.title.localeCompare(b.title, 'de') ||
          a.type.localeCompare(b.type) ||
          a.id - b.id,
      );
      const planning = await this.plan(
        manager,
        userId,
        filter,
        dates,
        today,
        now,
      );
      return {
        weeklyTargets: planning.targets,
        today,
        timeZone: DEFAULT_TIME_ZONE,
        startDate,
        endDate,
        days: dates.map((date) => ({
          date,
          items: items.filter((item) => item.date === date),
          planned: planning.items.filter((item) => item.date === date),
        })),
      };
    });
  }

  private async plan(
    manager: EntityManager,
    userId: string,
    filter: string,
    dates: string[],
    today: string,
    now: Date,
  ): Promise<{ items: HistoryPlannedItem[]; targets: HistoryWeeklyTarget[] }> {
    const items: HistoryPlannedItem[] = [];
    if (dates[dates.length - 1] < today) return { items, targets: [] };
    if (filter !== 'habits') {
      const todos = await manager
        .getRepository(TodoEntity)
        .createQueryBuilder('todo')
        .where('"todo"."userId" = :userId', { userId })
        .andWhere('"todo"."completed" = false')
        .andWhere('"todo"."scheduledAt" < :end', {
          end: endOfDay(dates[dates.length - 1]),
        })
        .andWhere('("todo"."scheduledAt" >= :start OR :current = true)', {
          start: startOfDay(dates[0]),
          current: dates.includes(today),
        })
        .getMany();
      for (const todo of todos) {
        const scheduledDate = dayOf(todo.scheduledAt!);
        const date = scheduledDate < today ? today : scheduledDate;
        if (dates.includes(date))
          items.push({
            key: `todo:${todo.id}`,
            type: 'todo',
            id: todo.id,
            habitId: null,
            title: todo.title,
            date,
            scheduledDate,
            isOverdue: scheduledDate < today,
            plannedDurationMinutes: todo.plannedDurationMinutes,
          });
      }
    }
    if (filter === 'todos') return { items, targets: [] };
    const habits = await manager
      .getRepository(HabitEntity)
      .find({ where: { userId, isActive: true } });
    if (!habits.length) return { items, targets: [] };
    const versions = await manager
      .getRepository(HabitScheduleVersionEntity)
      .createQueryBuilder('version')
      .where('"version"."habitId" IN (:...ids)', {
        ids: habits.map((habit) => habit.id),
      })
      .andWhere('"version"."cancelledAt" IS NULL')
      .orderBy('"version"."effectiveAt"', 'ASC')
      .addOrderBy('"version"."id"', 'ASC')
      .getMany();
    const slots = forecastSlots(versions, dates, today, now);
    const earliest = slots.reduce(
      (date, slot) => (slot.scheduledDate < date ? slot.scheduledDate : date),
      dates[0],
    );
    // Target progress is scoped to the selected calendar week even in day view.
    // Clamp its upper boundary at the supported four-digit calendar maximum.
    const { startDate: weekStart, endDate: weekEnd } = weekRange(dates[0]);
    const occurrences = await manager
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder('occurrence')
      .where('"occurrence"."habitId" IN (:...ids)', {
        ids: habits.map((habit) => habit.id),
      })
      .andWhere(
        '("occurrence"."scheduledDate" BETWEEN :earliest AND :end OR "occurrence"."resolvedDate" BETWEEN :weekStart AND :weekEnd)',
        { earliest, end: dates[dates.length - 1], weekStart, weekEnd },
      )
      .getMany();
    items.push(...plannedHabits(habits, slots, occurrences, today));
    items.sort(
      (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) ||
        a.title.localeCompare(b.title, 'de') ||
        a.key.localeCompare(b.key),
    );
    return {
      items,
      targets: weeklyTargets(habits, versions, occurrences, dates, today, now, {
        startDate: weekStart,
        endDate: weekEnd,
      }),
    };
  }
}
