import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { assertDateOnly } from '../common/date/date-only.utils';
import { releaseTimers } from '../timers/timer-target';
import { endFocusBlocksOfDone } from '../focus-blocks/focus-block-store';
import { TodoEntity } from './entities/todo.entity';

/**
 * Changing a quest's plan or completion, with everything that comes with it.
 * The HTTP paths (`TodosService`) and the Google sync both go through here,
 * so a quest moved by either one follows the same rules (`day-order.md`):
 *
 * - another day resets its place in the order of the day (`dayPosition`); a
 *   quest that loses its day drops its time and joins the end of the
 *   Questlog's order (`backlogPosition`), one that gets a day leaves it;
 * - a new or cleared time resets its place, so it anchors anew;
 * - an appointment needs a day;
 * - completing stamps `completedAt` once, clears its "Geblockt" marker and
 *   ends its stopwatch and its Fokus-Sperre in the same transaction;
 *   reopening clears the stamp.
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
 * stopwatch. Throws `BadRequestException` for a time without a day.
 */
export async function saveQuest(
  manager: EntityManager,
  todo: TodoEntity,
  change: QuestChange,
  now: Date,
  options: QuestChangeOptions = {},
): Promise<TodoEntity> {
  const { scheduledDate, timeOfDay, completed } = change;
  if (scheduledDate !== undefined && scheduledDate !== todo.scheduledDate)
    await moveToDay(manager, todo, scheduledDate, options.backlogPlace);
  if (timeOfDay !== undefined && timeOfDay !== todo.timeOfDay) {
    // A new time anchors it anew: right after the appointment before it.
    todo.timeOfDay = timeOfDay;
    todo.dayPosition = null;
  }
  if (completed !== undefined) {
    // A reopened quest is not "In Arbeit" until it is worked on again.
    if (todo.completed && !completed) todo.setAsideAt = now;
    todo.completed = completed;
    // A repeated completion keeps the original timestamp.
    if (completed) {
      todo.completedAt ??= now;
      todo.blocked = false;
    } else todo.completedAt = null;
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
