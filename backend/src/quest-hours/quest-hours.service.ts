import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Clock } from '../common/clock';
import { weekRange } from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { weekDates } from '../history/history-range';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { withCampaigns } from '../work-logs/day-logs';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import type {
  QuestHoursResponse,
  QuestTargetResponse,
} from './quest-hours.dto';
import { questWeek } from './quest-time';
import { setWeeklyQuestTarget, weeklyQuestTarget } from './weekly-target';

@Injectable()
export class QuestHoursService {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /**
   * The quest hours of the week from Monday `start`, from one consistent
   * read that writes nothing. Totals and the trend need every stretch the
   * user ever logged, so all of them are read.
   */
  week(userId: string, start: string): Promise<QuestHoursResponse> {
    weekDates(start);
    const today = this.clock.today();
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const ancestry = await loadTodoAncestry(manager, userId, today);
      const logs = await manager.find(WorkLogEntity, {
        where: { userId },
        order: { startedAt: 'ASC', id: 'ASC' },
      });
      // The goal that held for this week, not the one set today.
      const weeklyTargetMinutes = await weeklyQuestTarget(
        manager,
        userId,
        start,
      );
      return {
        ...questWeek(
          await withCampaigns(manager, userId, logs, ancestry),
          start,
          ancestry.campaignTargets(),
        ),
        today,
        weeklyTargetMinutes,
      };
    });
  }

  /** The goal of the running week. */
  async target(userId: string): Promise<QuestTargetResponse> {
    return {
      weeklyTargetMinutes: await weeklyQuestTarget(
        this.db.manager,
        userId,
        this.currentMonday(),
      ),
    };
  }

  /**
   * Sets the goal for the running week and the weeks after it. Weeks that
   * are over keep the goal they had.
   */
  setTarget(
    userId: string,
    weeklyTargetMinutes: number | null,
  ): Promise<QuestTargetResponse> {
    const monday = this.currentMonday();
    return this.unitOfWork.run(userId, async (manager) => {
      await setWeeklyQuestTarget(manager, userId, monday, weeklyTargetMinutes);
      return { weeklyTargetMinutes };
    });
  }

  private currentMonday(): string {
    return weekRange(this.clock.today()).startDate;
  }
}
