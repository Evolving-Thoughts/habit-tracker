import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { weekDates } from '../day-planner/week-plan';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { withCampaigns } from '../work-logs/day-logs';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import type {
  QuestHoursResponse,
  QuestTargetResponse,
} from './quest-hours.dto';
import { questWeek } from './quest-time';

/** The user's overall weekly goal in minutes; null without one. */
export async function weeklyQuestTarget(
  manager: EntityManager,
  userId: string,
): Promise<number | null> {
  const user = await manager.findOne(UserEntity, {
    select: { id: true, weeklyQuestTargetMinutes: true },
    where: { id: userId },
  });
  return user?.weeklyQuestTargetMinutes ?? null;
}

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
      const weeklyTargetMinutes = await weeklyQuestTarget(manager, userId);
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

  async target(userId: string): Promise<QuestTargetResponse> {
    return {
      weeklyTargetMinutes: await weeklyQuestTarget(this.db.manager, userId),
    };
  }

  setTarget(
    userId: string,
    weeklyTargetMinutes: number | null,
  ): Promise<QuestTargetResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      await manager.update(
        UserEntity,
        { id: userId },
        { weeklyQuestTargetMinutes: weeklyTargetMinutes },
      );
      return { weeklyTargetMinutes };
    });
  }
}
