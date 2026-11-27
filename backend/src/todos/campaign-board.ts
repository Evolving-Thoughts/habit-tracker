import { EntityManager } from 'typeorm';
import { TimerEntity } from '../timers/timer.entity';
import { WorkLogEntity } from '../work-logs/work-log.entity';

/**
 * Kampagnen-Board (docs/campaign-board.md): which quests are "In Arbeit",
 * and the transitions that move a quest between the columns. The other
 * columns follow from fields every todo response carries.
 */

/** What has happened on a quest, as far as "In Arbeit" is concerned. */
export type QuestWork = {
  /** A running or paused stopwatch is attached to it. */
  openTimer: boolean;
  /** End of its latest work log; null without any. */
  lastWorkEndedAt: Date | null;
};

/** What of a quest decides "In Arbeit". */
export type BoardQuest = {
  completed: boolean;
  setAsideAt: Date | null;
  startedAt: Date | null;
};

/**
 * An open quest is in progress while a stopwatch on it runs or is paused,
 * or once, after it was last set aside, work on it was logged or the user
 * took it into "In Arbeit" by hand. A log ending exactly at the set-aside is
 * the stopwatch the set-aside stopped, so it does not count.
 */
export function isInProgress(todo: BoardQuest, work: QuestWork): boolean {
  if (todo.completed) return false;
  if (work.openTimer) return true;
  const since = (moment: Date | null): boolean =>
    moment !== null && (!todo.setAsideAt || moment > todo.setAsideAt);
  return since(todo.startedAt) || since(work.lastWorkEndedAt);
}

/**
 * The moves between the columns, as pure transitions: each takes the
 * quest's board fields and returns the fields it changes, or a refusal.
 * `quest-commands.ts` applies and stores them.
 */

/** The board fields of a quest that its transitions read and write. */
export type BoardFields = BoardQuest & { blocked: boolean };

/** What a transition writes: only the fields it changes. */
export type BoardChange = Partial<
  Pick<BoardFields, 'setAsideAt' | 'startedAt' | 'blocked'>
>;

/** A completed quest stays in Erledigt: it is not moved or blocked. */
export type BoardRefusal = { refused: 'completed' };

/**
 * "Geblockt" ends once the quest moves on: worked on again (a stopwatch
 * started or resumed, or taken into work by hand) or completed.
 */
function liftBlocked(quest: Pick<BoardFields, 'blocked'>): BoardChange {
  return quest.blocked ? { blocked: false } : {};
}

/**
 * Setting an open quest aside: from now on only new work counts, and
 * `blocked` says whether it waits on something. The caller ends its
 * stopwatch.
 */
export function setAside(
  quest: Pick<BoardFields, 'completed'>,
  blocked: boolean,
  now: Date,
): BoardChange | BoardRefusal {
  if (quest.completed) return { refused: 'completed' };
  return { setAsideAt: now, blocked };
}

/**
 * Taking an open quest into "In Arbeit" by hand counts like work from now
 * on, without a stopwatch, and lifts "Geblockt".
 */
export function takeIntoWork(
  quest: Pick<BoardFields, 'completed' | 'blocked'>,
  now: Date,
): BoardChange | BoardRefusal {
  if (quest.completed) return { refused: 'completed' };
  return { startedAt: now, ...liftBlocked(quest) };
}

/** A stopwatch started or resumed on the quest lifts "Geblockt". */
export function resumeWork(quest: Pick<BoardFields, 'blocked'>): BoardChange {
  return liftBlocked(quest);
}

/** Completing a quest lifts "Geblockt"; a repeated completion too. */
export function complete(quest: Pick<BoardFields, 'blocked'>): BoardChange {
  return liftBlocked(quest);
}

/**
 * A reopened quest is not "In Arbeit" until it is worked on again, as if it
 * had been set aside now. An open quest stays as it is.
 */
export function reopen(
  quest: Pick<BoardFields, 'completed'>,
  now: Date,
): BoardChange {
  return quest.completed ? { setAsideAt: now } : {};
}

/**
 * Marking or unmarking "Geblockt" by hand. `quest.completed` is the
 * completion the quest will have, so a quest completed in the same change
 * cannot be blocked either.
 */
export function markBlocked(
  quest: Pick<BoardFields, 'completed'>,
  blocked: boolean,
): BoardChange | BoardRefusal {
  if (blocked && quest.completed) return { refused: 'completed' };
  return { blocked };
}

/** Which of the user's given todos are in progress, in two queries. */
export async function inProgressTodoIds(
  manager: EntityManager,
  userId: string,
  todos: ({ id: number } & BoardQuest)[],
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
