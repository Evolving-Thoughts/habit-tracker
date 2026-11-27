import { EntityManager } from 'typeorm';
import { TimerEntity } from '../timers/timer.entity';
import { WorkLogEntity } from '../work-logs/work-log.entity';

/**
 * Kampagnen-Board (docs/campaign-board.md): which quests are "In Arbeit".
 * The other columns follow from fields every todo response carries.
 */

/** What has happened on a quest, as far as "In Arbeit" is concerned. */
export type QuestWork = {
  /** A running or paused stopwatch is attached to it. */
  openTimer: boolean;
  /** End of its latest work log; null without any. */
  lastWorkEndedAt: Date | null;
};

/**
 * An open quest is in progress while a stopwatch on it runs or is paused,
 * or once work on it was logged after it was last set aside. A log ending
 * exactly then is the stopwatch the set-aside stopped, so it does not count.
 */
export function isInProgress(
  todo: { completed: boolean; setAsideAt: Date | null },
  work: QuestWork,
): boolean {
  if (todo.completed) return false;
  if (work.openTimer) return true;
  if (!work.lastWorkEndedAt) return false;
  return !todo.setAsideAt || work.lastWorkEndedAt > todo.setAsideAt;
}

/** Which of the user's given todos are in progress, in two queries. */
export async function inProgressTodoIds(
  manager: EntityManager,
  userId: string,
  todos: { id: number; completed: boolean; setAsideAt: Date | null }[],
): Promise<Set<number>> {
  const open = todos.filter((todo) => !todo.completed);
  if (!open.length) return new Set();
  const ids = open.map((todo) => todo.id);
  const [timers, logs] = await Promise.all([
    manager
      .getRepository(TimerEntity)
      .createQueryBuilder('timer')
      .select('"timer"."todoId"', 'todoId')
      .where('"timer"."userId" = :userId', { userId })
      .andWhere(`"timer"."state" IN ('running', 'paused')`)
      .andWhere('"timer"."todoId" = ANY(:ids)', { ids })
      .getRawMany<{ todoId: number }>(),
    manager
      .getRepository(WorkLogEntity)
      .createQueryBuilder('log')
      .select('"log"."todoId"', 'todoId')
      .addSelect('MAX("log"."endedAt")', 'endedAt')
      .where('"log"."userId" = :userId', { userId })
      .andWhere('"log"."todoId" = ANY(:ids)', { ids })
      .groupBy('"log"."todoId"')
      .getRawMany<{ todoId: number; endedAt: Date }>(),
  ]);
  const timed = new Set(timers.map((timer) => timer.todoId));
  const lastWork = new Map(logs.map((log) => [log.todoId, log.endedAt]));
  return new Set(
    open
      .filter((todo) =>
        isInProgress(todo, {
          openTimer: timed.has(todo.id),
          lastWorkEndedAt: lastWork.get(todo.id) ?? null,
        }),
      )
      .map((todo) => todo.id),
  );
}
