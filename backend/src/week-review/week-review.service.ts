import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { CategoryEntity } from '../categories/category.entity';
import { Clock } from '../common/clock';
import { addDays, weekRange } from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { weekDates } from '../history/history-range';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { resolvedOccurrences } from '../habit-occurrences/resolved-occurrences';
import { HabitEntity } from '../habits/entities/habit.entity';
import { perfectWeekOf } from '../history/perfect-week';
import { loadWeekQuota } from '../history/week-quota';
import { TodoEntity } from '../todos/entities/todo.entity';
import { GoalSnapshotEntity } from '../todos/goal-snapshot.entity';
import { completedTodos } from '../todos/todo-agenda';
import { Campaign, loadTodoAncestry } from '../todos/todo-ancestry';
import type {
  SaveWeekReviewDto,
  WeekReviewAnswers,
  WeekReviewResponse,
} from './week-review.dto';
import {
  answersOf,
  campaignProgress,
  countsInWeek,
  doneDays,
  isActiveIn,
  NO_ANSWERS,
  ProgressTodo,
  ReviewWeek,
} from './week-review';
import { WeekReviewEntity } from './week-review.entity';

@Injectable()
export class WeekReviewService {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /**
   * What the weekly review shows beyond the quest hours, from one consistent
   * read that writes nothing: campaign progress, quota, perfect week, the
   * done list and the stored answers.
   */
  week(userId: string, start: string): Promise<WeekReviewResponse> {
    const dates = weekDates(start);
    const week: ReviewWeek = {
      startDate: dates[0],
      endDate: dates[6],
      today: this.clock.today(),
    };
    const range = { firstDay: week.startDate, lastDay: week.endDate };
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const ancestry = await loadTodoAncestry(manager, userId, week.today);
      const todos = await this.progressTodos(manager, userId);
      const campaigns = todos.flatMap((todo): Campaign[] => {
        if (todo.parentId !== null || !isActiveIn(todo, week)) return [];
        const campaign = ancestry.campaignOf(todo);
        if (campaign) return [campaign];
        // A lone goal that counts a daily is something to work towards too.
        const { id, title, color, icon } = todo;
        return countsInWeek(todo, week) ? [{ id, title, color, icon }] : [];
      });
      const habitIds = [
        ...new Set(
          todos
            .filter((todo) => countsInWeek(todo, week))
            .map((todo) => todo.goalHabitId!),
        ),
      ];
      const done = await completedTodos(manager, userId, {
        ...range,
        withDeleted: true,
      });
      const resolved = await resolvedOccurrences(manager, userId, {
        ...range,
        withDeleted: true,
      });
      const categories = await manager.find(CategoryEntity, {
        where: { userId },
        order: { name: 'ASC' },
      });
      const stored = await manager.findOne(WeekReviewEntity, {
        where: { userId, week: week.startDate },
      });
      return {
        ...week,
        campaigns: campaignProgress(
          campaigns,
          todos,
          await this.snapshots(manager, userId, campaigns, week),
          await this.goalRuns(manager, userId, habitIds, week.endDate),
          await this.habitTitles(manager, userId, habitIds),
          week,
        ),
        weekQuota: await loadWeekQuota(
          manager,
          userId,
          week.startDate,
          week.endDate,
        ),
        perfectWeek: perfectWeekOf(categories, done, resolved),
        days: doneDays(week, done, resolved, {
          todo: (id) => ancestry.todoCampaign(id),
          habit: (habitId) => ancestry.habitCampaign(habitId),
        }),
        answers: stored
          ? {
              wentWell: stored.wentWell,
              wentBadly: stored.wentBadly,
              changeNext: stored.changeNext,
            }
          : NO_ANSWERS,
      };
    });
  }

  /**
   * Replaces the answers of a week that has begun. Empty answers are stored
   * as null, and a review without any answer keeps no row.
   */
  save(
    userId: string,
    week: string,
    dto: SaveWeekReviewDto,
  ): Promise<WeekReviewAnswers> {
    weekDates(week);
    if (week > weekRange(this.clock.today()).startDate)
      throw new BadRequestException(
        'Einen Wochenrückblick gibt es erst, wenn die Woche begonnen hat.',
      );
    const answers = answersOf(dto);
    return this.unitOfWork.run(userId, async (manager) => {
      if (answers)
        await manager.upsert(WeekReviewEntity, { userId, week, ...answers }, [
          'userId',
          'week',
        ]);
      else await manager.delete(WeekReviewEntity, { userId, week });
      return answers ?? NO_ANSWERS;
    });
  }

  /** Every live todo with what progress, campaign and goals need. */
  private progressTodos(
    manager: EntityManager,
    userId: string,
  ): Promise<(ProgressTodo & Campaign)[]> {
    return manager.find(TodoEntity, {
      select: {
        id: true,
        parentId: true,
        title: true,
        color: true,
        icon: true,
        completed: true,
        completedAt: true,
        createdAt: true,
        plannedDurationMinutes: true,
        goalHabitId: true,
        goalTarget: true,
        periodStart: true,
        periodEnd: true,
      },
      where: { userId },
    });
  }

  /** The snapshots that can tell the start (the week before) and the end. */
  private async snapshots(
    manager: EntityManager,
    userId: string,
    campaigns: Campaign[],
    week: ReviewWeek,
  ): Promise<GoalSnapshotEntity[]> {
    if (!campaigns.length) return [];
    return manager.find(GoalSnapshotEntity, {
      where: {
        userId,
        rootTodoId: In(campaigns.map(({ id }) => id)),
        date: Between(addDays(week.startDate, -7), week.endDate),
      },
    });
  }

  /** Completed runs of the goals' dailies, up to the week's end. */
  private async goalRuns(
    manager: EntityManager,
    userId: string,
    habitIds: number[],
    endDate: string,
  ): Promise<{ habitId: number; resolvedDate: string | null }[]> {
    if (!habitIds.length) return [];
    return manager
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder('occurrence')
      .withDeleted()
      .innerJoin('occurrence.habit', 'habit')
      .select([
        'occurrence.id',
        'occurrence.habitId',
        'occurrence.resolvedDate',
      ])
      .where('"habit"."userId" = :userId', { userId })
      .andWhere('"occurrence"."habitId" IN (:...habitIds)', { habitIds })
      .andWhere('"occurrence"."status" = :status', {
        status: HabitOccurrenceStatus.COMPLETED,
      })
      .andWhere('"occurrence"."resolvedDate" <= :endDate', { endDate })
      .getMany();
  }

  private async habitTitles(
    manager: EntityManager,
    userId: string,
    habitIds: number[],
  ): Promise<Map<number, string>> {
    if (!habitIds.length) return new Map();
    const habits = await manager.find(HabitEntity, {
      select: { id: true, title: true },
      where: { userId, id: In(habitIds) },
      withDeleted: true,
    });
    return new Map(habits.map(({ id, title }) => [id, title]));
  }
}
