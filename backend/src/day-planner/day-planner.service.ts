import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { eventsOfDays } from '../calendar/day-events';
import { dayOf, weekRange } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import {
  isOccurrenceTimerEligible,
  isTodoTimerEligible,
} from '../timers/timer-target';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { lastMovableDate } from '../habits/scheduling/schedule-rules';
import { loadStreaks, NO_STREAK } from '../habits/streaks';
import { TodoEntity } from '../todos/entities/todo.entity';
import { habitGoals } from '../todos/habit-goal';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { logsOfDays, withCampaigns } from '../work-logs/day-logs';
import { workedMinutes } from '../work-logs/work-time';
import {
  completedTodos,
  openScheduledTodos,
  overdueTodos,
  placeOpenTodo,
} from '../todos/todo-agenda';
import { resolvedOccurrences } from '../habit-occurrences/resolved-occurrences';
import { loadHabitForecast } from '../history/habit-forecast';
import { openTargetRuns, plannedHabits } from '../history/history-planning';
import { weeklyQuestTarget } from '../quest-hours/weekly-target';
import { questSoFar } from '../quest-hours/quest-time';
import { loadAgendaContext } from './agenda-context';
import {
  findRunningChallenge,
  runningChallengeResponse,
} from '../month-challenges/challenge-store';
import { monthEnd } from '../month-challenges/challenge-rules';
import { sortInDay } from './day-order';
import {
  DayPlannerGoalDto,
  DayPlannerHabitItemDto,
  DayPlannerItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';
import { WeekPlanResponseDto } from './dto/week-plan.dto';
import {
  arrangePlan,
  planDates,
  plannedHabitCandidate,
  resolvedHabitCandidate,
  todoCandidate,
} from './week-plan';

/** Fields filled after mapping, from lookups across all items. */
type ContextField =
  | 'categoryName'
  | 'categoryColor'
  | 'why'
  | 'goal'
  | 'campaign'
  | 'workedMinutes'
  | 'streak'
  | 'monthChallenge';

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

    const [todos, occurrences, context] = await Promise.all([
      this.findTodosForToday(userId, today),
      this.scheduling.getToday(userId),
      loadAgendaContext(this.db.manager, userId, today),
    ]);
    const { ancestry } = context;
    // Runs are reconciled now: the challenge counts today's as stored.
    const monthChallenge = await runningChallengeResponse(
      this.db.manager,
      userId,
      this.clock.now(),
    );

    // The week's stretches: today's work and the week's quest hours.
    const { startDate, endDate } = weekRange(today);
    const [parents, habitGoalsByHabit, logs, questTarget, streaks] =
      await Promise.all([
        this.parentsOf(userId, todos),
        this.habitGoalsFor(
          userId,
          occurrences.map((occurrence) => occurrence.habitId),
          today,
        ),
        logsOfDays(this.db.manager, userId, startDate, endDate),
        weeklyQuestTarget(this.db.manager, userId, startDate),
        loadStreaks(
          this.db.manager,
          occurrences.map((occurrence) => occurrence.habitId),
          this.clock.now(),
        ),
      ]);
    const workedOn = (key: 'todoId' | 'occurrenceId', id: number): number =>
      workedMinutes(
        logs.filter((log) => log[key] === id),
        today,
      );

    const entries = [
      ...todos.map((todo) => {
        const parent =
          todo.parentId === null ? undefined : parents.get(todo.parentId);
        const item: DayPlannerItemDto = {
          ...this.mapTodo(todo, today),
          ...context.todo(todo),
          goal: parent
            ? { title: parent, completed: null, target: null, periodEnd: null }
            : null,
          workedMinutes: workedOn('todoId', todo.id),
        };
        return { item, id: todo.id, dayPosition: todo.dayPosition };
      }),
      ...occurrences.map((occurrence) => {
        const item: DayPlannerItemDto = {
          ...this.mapOccurrence(occurrence, today),
          ...context.habit(occurrence.habit),
          goal: habitGoalsByHabit.get(occurrence.habitId) ?? null,
          workedMinutes: workedOn('occurrenceId', occurrence.id),
          streak: streaks.get(occurrence.habitId) ?? NO_STREAK,
          monthChallenge: monthChallenge?.habitId === occurrence.habitId,
        };
        return { item, id: occurrence.id, dayPosition: occurrence.dayPosition };
      }),
    ];
    const items = sortInDay(entries, (entry) => ({
      ...entry,
      ...entry.item,
    })).map(({ item, dayPosition }) => ({ ...item, dayPosition }));

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
      workedMinutes: workedMinutes(logs, today),
      questHours: {
        ...questSoFar(
          await withCampaigns(this.db.manager, userId, logs, ancestry),
          today,
        ),
        weeklyTargetMinutes: questTarget,
      },
      monthChallenge,
    });
  }

  /**
   * `days` days from `from` as a board of columns, and what is overdue,
   * from one consistent read. Todos follow the todo agenda, habits the
   * forecast history uses; past days only show what was done. Today's runs
   * are stored first, as Heute does, so the board can sort, move and open
   * them like Heute; later days keep their forecast.
   */
  async getPlan(
    userId: string,
    from: string,
    days: number,
  ): Promise<WeekPlanResponseDto> {
    const dates = planDates(from, days);
    const firstDay = dates[0];
    const lastDay = dates[dates.length - 1];
    const now = this.clock.now();
    const today = dayOf(now);
    // Open items only exist from today on; earlier ones are overdue.
    const ahead = dates.filter((date) => date >= today);
    // Today is always forecast: its carried-over runs are overdue.
    const forecastDates = [today, ...ahead.filter((date) => date !== today)];
    await this.scheduling.reconcileAll(userId);
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const ancestry = await loadTodoAncestry(manager, userId, today);
      const open = ahead.length
        ? await openScheduledTodos(manager, userId, {
            firstDay: ahead[0],
            lastDay,
            includeOverdue: false,
          })
        : [];
      const overdue = await overdueTodos(manager, userId, today);
      const completed = await completedTodos(manager, userId, {
        firstDay,
        lastDay,
      });
      const resolved = await resolvedOccurrences(manager, userId, {
        firstDay,
        lastDay,
      });
      const forecast = await loadHabitForecast(
        manager,
        userId,
        forecastDates,
        today,
        now,
      );
      const positions = new Map(
        forecast.occurrences.map(({ id, dayPosition }) => [id, dayPosition]),
      );
      const streaks = await loadStreaks(
        manager,
        [
          ...forecast.habits.map(({ id }) => id),
          ...resolved.map(({ habitId }) => habitId),
        ],
        now,
      );
      const streakOf = (habitId: number) => streaks.get(habitId) ?? NO_STREAK;
      // The marker: runs of the challenge's Daily within its month.
      const challenge = await findRunningChallenge(manager, userId, today);
      const challengeOn = (habitId: number, date: string) =>
        challenge?.habitId === habitId && date <= monthEnd(challenge.month);
      const planned = [
        ...plannedHabits(
          forecast.habits,
          forecast.slots,
          forecast.occurrences,
          today,
        ),
        // Today's run of a weekly target, as Heute lists it.
        ...(dates.includes(today)
          ? openTargetRuns(
              forecast.habits,
              forecast.versions,
              forecast.occurrences,
              today,
            )
          : []),
      ]
        // A stable start for runs that were never sorted.
        .sort((first, second) => first.title.localeCompare(second.title, 'de'));

      const candidates = [
        ...[...overdue, ...open, ...completed].map((todo) =>
          todoCandidate(todo, today, ancestry.campaignOf(todo)),
        ),
        ...planned.map((item) =>
          plannedHabitCandidate(
            item,
            item.id === null ? null : (positions.get(item.id) ?? null),
            today,
            ancestry.habitCampaign(item.habitId!),
            streakOf(item.habitId!),
            challengeOn(item.habitId!, item.date < today ? today : item.date),
          ),
        ),
        ...resolved.map((occurrence) =>
          resolvedHabitCandidate(
            {
              ...occurrence,
              status:
                occurrence.status === HabitOccurrenceStatus.COMPLETED
                  ? 'completed'
                  : 'skipped',
            },
            occurrence.habit,
            effectiveDuration(occurrence, occurrence.habit),
            ancestry.habitCampaign(occurrence.habitId),
            streakOf(occurrence.habitId),
            challengeOn(
              occurrence.habitId,
              occurrence.resolvedDate ?? occurrence.scheduledDate,
            ),
          ),
        ),
      ];
      return {
        startDate: firstDay,
        endDate: lastDay,
        today,
        ...arrangePlan(dates, candidates),
      };
    });
  }

  /**
   * Stores the order the user sorted a day into: every item takes its index
   * as position. It works for any day, because a position only counts among
   * the items of the day an item is on. Nothing is written unless all items
   * are the user's own.
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
      focusBlock: todo.focusBlock ?? 'default',
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
      focusBlock: occurrence.habit.focusBlock ?? 'default',
    };
  }
}
