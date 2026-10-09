import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DEFAULT_TIME_ZONE,
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from '../common/date/date-only.utils';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { addHistoryDays, historyRange } from './history-range';
import { HistoryQueryDto, HistoryResponse, HistoryItem } from './history.dto';

@Injectable()
export class HistoryService {
  constructor(private readonly db: DataSource) {}
  async get(userId: string, query: HistoryQueryDto): Promise<HistoryResponse> {
    const today = getCurrentDateInTimeZone();
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
                  start: midnightInTimeZone(startDate),
                  end: midnightInTimeZone(addHistoryDays(endDate, 1)),
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
          date: getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, todo.completedAt!),
          scheduledDate: todo.scheduledAt
            ? getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, todo.scheduledAt)
            : null,
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
          plannedDurationMinutes:
            occurrence.plannedDurationMinutes ??
            occurrence.habit.plannedDurationMinutes,
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
      return {
        today,
        timeZone: DEFAULT_TIME_ZONE,
        startDate,
        endDate,
        days: dates.map((date) => ({
          date,
          items: items.filter((item) => item.date === date),
        })),
      };
    });
  }
}
