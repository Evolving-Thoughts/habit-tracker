import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { loadHabitForecast } from './habit-forecast';
import {
  openTargetRuns,
  plannedHabits,
  sortedLikeToday,
  weeklyTargets,
} from './history-planning';
import { HabitEntity } from '../habits/entities/habit.entity';
import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import { dayOf, weekRange } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { effectiveDuration } from '../timers/timer-target';
import {
  completedTodos,
  openScheduledTodos,
  placeOpenTodo,
} from '../todos/todo-agenda';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { resolvedOccurrences } from '../habit-occurrences/resolved-occurrences';
import { historyRange } from './history-range';
import { eventsOfDays } from '../calendar/day-events';
import { CategoryEntity } from '../categories/category.entity';
import { perfectWeekOf } from './perfect-week';
import { loadWeekQuota } from './week-quota';
import {
  HistoryQueryDto,
  HistoryResponse,
  HistoryItem,
  HistoryPlannedItem,
  HistoryWeeklyTarget,
} from './history.dto';
import { loadTodoAncestry, TodoAncestry } from '../todos/todo-ancestry';
import { logsOfDays, withCampaigns } from '../work-logs/day-logs';
import { dayWork } from './history-work';

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
      const categories = await manager
        .getRepository(CategoryEntity)
        .find({ where: { userId }, order: { name: 'ASC' } });
      const ancestry = await loadTodoAncestry(manager, userId, today);
      const names = new Map(categories.map((item) => [item.id, item.name]));
      const categoryName = (id: number | null): string | null =>
        id === null ? null : (names.get(id) ?? null);
      const todos =
        filter === 'habits'
          ? []
          : await completedTodos(manager, userId, {
              firstDay: startDate,
              lastDay: endDate,
              withDeleted: true,
            });
      const occurrences =
        filter === 'todos'
          ? []
          : await resolvedOccurrences(manager, userId, {
              firstDay: startDate,
              lastDay: endDate,
              withDeleted: true,
            });
      const items: HistoryItem[] = [
        ...todos.map((todo) => ({
          type: 'todo' as const,
          id: todo.id,
          habitId: null,
          title: todo.title,
          categoryName: categoryName(todo.categoryId),
          why: ancestry.todoWhy(todo),
          status: 'completed' as const,
          date: dayOf(todo.completedAt!),
          scheduledDate: todo.scheduledDate ?? null,
          resolvedAt: todo.completedAt!.toISOString(),
          plannedDurationMinutes: todo.plannedDurationMinutes,
          timeOfDay: todo.timeOfDay ?? null,
          deleted: todo.deletedAt !== null,
        })),
        ...occurrences.map((occurrence) => ({
          type: 'habit' as const,
          id: occurrence.id,
          habitId: occurrence.habitId,
          title: occurrence.habit.title,
          categoryName: categoryName(occurrence.habit.categoryId),
          why: ancestry.habitWhy(occurrence.habit),
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
          timeOfDay: occurrence.habit.timeOfDay ?? null,
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
        categoryName,
        ancestry,
      );
      const external =
        query.view === 'week'
          ? null
          : await eventsOfDays(manager, { userId }, startDate, endDate);
      const logs = await withCampaigns(
        manager,
        userId,
        (await logsOfDays(manager, userId, startDate, endDate)).filter(
          (log) =>
            filter === 'all' || (filter === 'todos') === (log.todoId !== null),
        ),
        ancestry,
      );
      return {
        ...(query.view === 'week' && filter === 'all'
          ? {
              perfectWeek: perfectWeekOf(categories, todos, occurrences),
            }
          : {}),
        weeklyTargets: planning.targets,
        ...(query.view === 'week' && filter !== 'todos'
          ? {
              weekQuota: await loadWeekQuota(
                manager,
                userId,
                startDate,
                endDate,
              ),
            }
          : {}),
        today,
        timeZone: DEFAULT_TIME_ZONE,
        startDate,
        endDate,
        days: dates.map((date) => ({
          date,
          items: items.filter((item) => item.date === date),
          planned: planning.items.filter((item) => item.date === date),
          ...(external
            ? {
                external: external
                  .filter((event) => dayOf(event.start) === date)
                  .map(({ id, title, start, end }) => ({
                    id,
                    title,
                    start: start.toISOString(),
                    end: end.toISOString(),
                  })),
              }
            : {}),
          work: dayWork(logs, date, query.view !== 'month'),
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
    categoryName: (id: number | null) => string | null,
    ancestry: TodoAncestry,
  ): Promise<{ items: HistoryPlannedItem[]; targets: HistoryWeeklyTarget[] }> {
    const items: HistoryPlannedItem[] = [];
    if (dates[dates.length - 1] < today) return { items, targets: [] };
    /** Where each entry was sorted into its day, by key. */
    const positions = new Map<string, number | null>();
    if (filter !== 'habits') {
      const todos = await openScheduledTodos(manager, userId, {
        firstDay: dates[0],
        lastDay: dates[dates.length - 1],
        includeOverdue: dates.includes(today),
      });
      for (const todo of todos) {
        const { scheduledDate, date, isOverdue } = placeOpenTodo(todo, today);
        positions.set(`todo:${todo.id}`, todo.dayPosition);
        if (dates.includes(date))
          items.push({
            key: `todo:${todo.id}`,
            type: 'todo',
            id: todo.id,
            habitId: null,
            title: todo.title,
            categoryName: categoryName(todo.categoryId),
            why: ancestry.todoWhy(todo),
            date,
            scheduledDate,
            isOverdue,
            plannedDurationMinutes: todo.plannedDurationMinutes,
            timeOfDay: todo.timeOfDay ?? null,
            moveUntil: null,
          });
      }
    }
    if (filter === 'todos')
      return { items: sortedLikeToday(items, positions), targets: [] };
    const { habits, versions, occurrences, slots } = await loadHabitForecast(
      manager,
      userId,
      dates,
      today,
      now,
    );
    if (!habits.length)
      return { items: sortedLikeToday(items, positions), targets: [] };
    // Target progress is scoped to the selected calendar week even in day view.
    const { startDate: weekStart, endDate: weekEnd } = weekRange(dates[0]);
    const why = (habit: HabitEntity) => ancestry.habitWhy(habit);
    items.push(
      ...plannedHabits(habits, slots, occurrences, today, categoryName, why),
      ...(dates.includes(today)
        ? openTargetRuns(
            habits,
            versions,
            occurrences,
            today,
            categoryName,
            why,
          )
        : []),
    );
    const stored = new Map(
      occurrences.map((occurrence) => [occurrence.id, occurrence.dayPosition]),
    );
    for (const item of items)
      if (item.type === 'habit' && item.id !== null)
        positions.set(item.key, stored.get(item.id) ?? null);
    return {
      items: sortedLikeToday(items, positions),
      targets: weeklyTargets(habits, versions, occurrences, dates, today, now, {
        startDate: weekStart,
        endDate: weekEnd,
      }),
    };
  }
}
