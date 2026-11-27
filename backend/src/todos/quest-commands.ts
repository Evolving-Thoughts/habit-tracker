import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertDateOnly } from '../common/date/date-only.utils';
import { releaseTimers } from '../timers/timer-target';
import { endFocusBlocksOfDone } from '../focus-blocks/focus-block-store';
import { TodoEntity } from './entities/todo.entity';
import {
  BoardChange,
  BoardRefusal,
  complete,
  markBlocked,
  reopen,
  resumeWork,
  setAside,
  takeIntoWork,
} from './campaign-board';

/**
 * Changing a quest's plan, completion or place on the Kampagnen-Board, with
 * everything that comes with it. The HTTP paths (`TodosService`), the Google
 * sync and the stopwatch all go through here, so a quest moved by any of
 * them follows the same rules (`day-order.md`, `campaign-board.md`; the
 * board's transitions themselves are pure, in `campaign-board.ts`):
 *
 * - another day resets its place in the order of the day (`dayPosition`); a
 *   quest that loses its day drops its time and joins the end of the
 *   Questlog's order (`backlogPosition`), one that gets a day leaves it;
 * - a new or cleared time resets its place, so it anchors anew;
 * - an appointment needs a day;
 * - completing stamps `completedAt` once, clears its "Geblockt" marker and
 *   ends its stopwatch and its Fokus-Sperre in the same transaction;
 *   reopening clears the stamp and sets it aside;
 * - a completed quest cannot be blocked, set aside or taken into work (409).
 *
 * Callers hold the per-user unit of work (`UserUnitOfWork`), so the timer
 * writes of `releaseTimers` keep the lock order user row → todo/timer rows.
 */
export type QuestChange = {
  /** A day (`YYYY-MM-DD`), or null for the Questlog. */
  scheduledDate?: string | null;
  /** `HH:mm`, or null for a quest without an appointment. */
  timeOfDay?: string | null;
  completed?: boolean;
  /** Marks or unmarks it as "Geblockt". */
  blocked?: boolean;
};

export type QuestChangeOptions = {
  /**
   * Where a quest that loses its day lands in the Questlog: at the end
   * (default), or without a place, after every placed one. The Google sync
   * uses `none` for an appointment whose event was deleted there.
   */
  backlogPlace?: 'end' | 'none';
};

/**
 * Applies the change to a loaded quest together with whatever other fields
 * the caller set on it, saves it and, once it is completed, ends its
 * stopwatch. Throws `BadRequestException` for a time without a day and
 * `ConflictException` for blocking a quest that is or becomes completed.
 */
export async function saveQuest(
  manager: EntityManager,
  todo: TodoEntity,
  change: QuestChange,
  now: Date,
  options: QuestChangeOptions = {},
): Promise<TodoEntity> {
  const { scheduledDate, timeOfDay, completed, blocked } = change;
  if (blocked !== undefined)
    applyBoard(
      todo,
      markBlocked({ completed: completed ?? todo.completed }, blocked),
      'Erledigte Quests können nicht geblockt werden.',
    );
  if (scheduledDate !== undefined && scheduledDate !== todo.scheduledDate)
    await moveToDay(manager, todo, scheduledDate, options.backlogPlace);
  if (timeOfDay !== undefined && timeOfDay !== todo.timeOfDay) {
    // A new time anchors it anew: right after the appointment before it.
    todo.timeOfDay = timeOfDay;
    todo.dayPosition = null;
  }
  if (completed !== undefined) {
    Object.assign(todo, completed ? complete(todo) : reopen(todo, now));
    todo.completed = completed;
    // A repeated completion keeps the original timestamp.
    if (completed) todo.completedAt ??= now;
    else todo.completedAt = null;
  }
  assertQuestPlan(todo.scheduledDate, todo.timeOfDay);
  const saved = await manager.getRepository(TodoEntity).save(todo);
  // A completed quest is no stopwatch target any more, and its
  // Fokus-Sperre ends, Hardcore included.
  if (todo.completed) {
    await releaseTimers(manager, todo.userId, { todoIds: [todo.id] }, now);
    await endFocusBlocksOfDone(
      manager,
      todo.userId,
      { todoIds: [todo.id] },
      now,
    );
  }
  return saved;
}

/**
 * Sets an open quest aside (`setAside`): its stopwatch ends with its work
 * logged, in the caller's transaction. A completed quest is a 409.
 */
export async function setQuestAside(
  manager: EntityManager,
  todo: TodoEntity,
  blocked: boolean,
  now: Date,
): Promise<TodoEntity> {
  applyBoard(
    todo,
    setAside(todo, blocked, now),
    'Erledigte Quests können nicht zurückgelegt werden.',
  );
  await releaseTimers(manager, todo.userId, { todoIds: [todo.id] }, now);
  return manager.getRepository(TodoEntity).save(todo);
}

/**
 * Takes an open quest into "In Arbeit" by hand (`takeIntoWork`); no
 * stopwatch starts. A completed quest is a 409.
 */
export async function takeQuestIntoWork(
  manager: EntityManager,
  todo: TodoEntity,
  now: Date,
): Promise<TodoEntity> {
  applyBoard(
    todo,
    takeIntoWork(todo, now),
    'Erledigte Quests können nicht in Arbeit genommen werden.',
  );
  return manager.getRepository(TodoEntity).save(todo);
}

/**
 * A stopwatch started or resumed on the quest (`resumeWork`): stores only
 * what changes, so a locked target is not written back as a whole.
 */
export async function resumeQuestWork(
  manager: EntityManager,
  todo: TodoEntity,
): Promise<void> {
  const change = resumeWork(todo);
  if (!Object.keys(change).length) return;
  Object.assign(todo, change);
  await manager.update(
    TodoEntity,
    { id: todo.id, userId: todo.userId },
    change,
  );
}

/** Puts a board transition's change on the quest, or refuses it with 409. */
function applyBoard(
  todo: TodoEntity,
  outcome: BoardChange | BoardRefusal,
  refusal: string,
): void {
  if ('refused' in outcome) throw new ConflictException(refusal);
  Object.assign(todo, outcome);
}

/** A day must be a calendar day, and only a quest with a day has a time. */
export function assertQuestPlan(
  scheduledDate: string | null,
  timeOfDay: string | null,
): void {
  if (scheduledDate !== null) assertDateOnly(scheduledDate);
  else if (timeOfDay !== null)
    throw new BadRequestException('An appointment needs a day');
}

/**
 * Another day has its own order, so the quest joins it at the end. Back in
 * the Questlog there is no day an appointment could be on.
 */
async function moveToDay(
  manager: EntityManager,
  todo: TodoEntity,
  date: string | null,
  backlogPlace: 'end' | 'none' = 'end',
): Promise<void> {
  todo.scheduledDate = date;
  todo.dayPosition = null;
  todo.backlogPosition =
    date === null && backlogPlace === 'end'
      ? await nextBacklogPosition(manager, todo.userId)
      : null;
  if (date === null) todo.timeOfDay = null;
}

/** The place after every quest of the user that has no day. */
export async function nextBacklogPosition(
  manager: EntityManager,
  userId: string,
): Promise<number> {
  const last = await backlogEdge(manager, userId, 'MAX');
  return last === null ? 0 : last + 1;
}

/**
 * The place before every quest of the user that has no day, in the same
 * transaction as the insert; positions may go below zero.
 */
export async function firstBacklogPosition(
  manager: EntityManager,
  userId: string,
): Promise<number> {
  const first = await backlogEdge(manager, userId, 'MIN');
  return first === null ? 0 : first - 1;
}

async function backlogEdge(
  manager: EntityManager,
  userId: string,
  edge: 'MIN' | 'MAX',
): Promise<number | null> {
  const result = await manager
    .getRepository(TodoEntity)
    .createQueryBuilder('todo')
    .select(`${edge}("todo"."backlogPosition")`, 'edge')
    .where('"todo"."userId" = :userId', { userId })
    .andWhere('"todo"."scheduledDate" IS NULL')
    .getRawOne<{ edge: number | null }>();
  return result?.edge == null ? null : Number(result.edge);
}
