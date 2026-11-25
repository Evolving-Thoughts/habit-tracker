import { Brackets, EntityManager, IsNull } from 'typeorm';
import {
  FocusBlockEntity,
  FocusBlockSettingsEntity,
} from './focus-block.entities';
import {
  blockApplies,
  blockShape,
  DEFAULT_THRESHOLD_MINUTES,
  lapsedReason,
  lapsesAt,
  type FocusBlockMode,
  type FocusBlockOverride,
  type FocusListMode,
  type FocusTriggerKind,
} from './focus-block-rules';

/**
 * Reading and writing block sessions inside a caller's transaction. No Nest
 * dependencies, so the stopwatch (`timer-target.ts`, `timers.service.ts`),
 * quests and dailies can start and end blocks in the same transaction as
 * their own change without module cycles. Callers hold the per-user unit of
 * work (`UserUnitOfWork`).
 *
 * The block follows the stopwatch in one place: every stopwatch that starts
 * or resumes running calls `startFocusBlock` (`TimersService`), every pause
 * and stop goes through `recordTransition`, which calls
 * `focusBlockFollowsStopwatch`. Where the stopwatch was started (Heute,
 * Fokus-Modus, Plan, Questlog, a notification) does not matter.
 */

export type FocusSettings = {
  enabled: boolean;
  trigger: FocusTriggerKind;
  thresholdMinutes: number;
  mode: FocusBlockMode;
  listMode: FocusListMode;
};

/** On, whenever the stopwatch runs, Soft, Sperrliste. */
export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  enabled: true,
  trigger: 'stopwatch',
  thresholdMinutes: DEFAULT_THRESHOLD_MINUTES,
  mode: 'soft',
  listMode: 'blocklist',
};

export async function readFocusSettings(
  manager: EntityManager,
  userId: string,
): Promise<FocusSettings> {
  const row = await manager.findOneBy(FocusBlockSettingsEntity, { userId });
  if (!row) return { ...DEFAULT_FOCUS_SETTINGS };
  const { enabled, trigger, thresholdMinutes, mode, listMode } = row;
  return { enabled, trigger, thresholdMinutes, mode, listMode };
}

/**
 * The person's open block, or null. A block past its moment (Hardcore at
 * its Soll moment, any other after 12 hours) is closed here with that moment, so every
 * reader sees it over as soon as the clock passes it.
 */
export async function openFocusBlock(
  manager: EntityManager,
  userId: string,
  now: Date,
): Promise<FocusBlockEntity | null> {
  const block = await manager.findOneBy(FocusBlockEntity, {
    userId,
    endedAt: IsNull(),
  });
  if (!block) return null;
  const reason = lapsedReason(block, now);
  if (!reason) return block;
  block.endedAt = lapsesAt(block);
  block.endReason = reason;
  await manager.save(FocusBlockEntity, block);
  return null;
}

export type FocusStart = {
  target: { todoId: number } | { occurrenceId: number };
  title: string;
  /** The quest's or daily's own choice. */
  override: FocusBlockOverride;
  /** The stopwatch's Soll (`targetMinutes`) and the time it shows now. */
  targetMinutes: number | null;
  elapsedMilliseconds: number;
  /** Soft or Hardcore as picked on the Fokus screen; else the default. */
  mode?: FocusBlockMode;
  /** "Sperre starten" by hand: no trigger rule to pass. */
  force?: boolean;
};

/**
 * Starts a block for a stopwatch that just started or resumed running,
 * wherever that happened, when the rule calls for one (`blockApplies`). An
 * open block stays as it is. Its end follows `blockShape`: Hardcore with
 * the threshold trigger needs a Soll still ahead, else it starts as Soft.
 */
export async function startFocusBlock(
  manager: EntityManager,
  userId: string,
  start: FocusStart,
  now: Date,
): Promise<FocusBlockEntity | null> {
  const open = await openFocusBlock(manager, userId, now);
  if (open) return open;
  const settings = await readFocusSettings(manager, userId);
  if (
    !start.force &&
    !blockApplies(settings, start.override, start.targetMinutes)
  )
    return null;
  const { mode, endsAt } = blockShape(
    start.mode ?? settings.mode,
    settings.trigger,
    start.targetMinutes,
    start.elapsedMilliseconds,
    now,
  );
  return manager.save(
    FocusBlockEntity,
    manager.create(FocusBlockEntity, {
      userId,
      todoId: 'todoId' in start.target ? start.target.todoId : null,
      occurrenceId:
        'occurrenceId' in start.target ? start.target.occurrenceId : null,
      title: start.title,
      mode,
      listMode: settings.listMode,
      startedAt: now,
      endsAt,
      endedAt: null,
      endReason: null,
    }),
  );
}

/**
 * The stopwatch paused or ended. Pausing ends a Soft block (resuming starts
 * a new one); Hardcore holds through pauses. Ending the stopwatch also ends
 * Hardcore without a Soll moment (stopwatch trigger); Hardcore with one
 * (threshold trigger) holds until that moment or until its quest or run is
 * done. A block started after `at` (a stretch cut in hindsight) ends at
 * its own start.
 */
export async function focusBlockFollowsStopwatch(
  manager: EntityManager,
  userId: string,
  event: 'pause' | 'stop',
  at: Date,
): Promise<void> {
  await manager
    .getRepository(FocusBlockEntity)
    .createQueryBuilder()
    .update()
    .set({
      endedAt: () => 'GREATEST(CAST(:at AS timestamptz), "startedAt")',
      endReason: event === 'pause' ? 'paused' : 'stopwatch_stopped',
    })
    .setParameter('at', at)
    .where('"userId" = :userId', { userId })
    .andWhere('"endedAt" IS NULL')
    .andWhere(
      event === 'pause'
        ? `"mode" = 'soft'`
        : `("mode" = 'soft' OR "endsAt" IS NULL)`,
    )
    .execute();
}

/**
 * Quests or runs were completed: their open blocks end, Hardcore included.
 * Call it in the transaction that completes them.
 */
export async function endFocusBlocksOfDone(
  manager: EntityManager,
  userId: string,
  targets: { todoIds?: number[]; occurrenceIds?: number[] },
  at: Date,
): Promise<void> {
  const todoIds = targets.todoIds ?? [];
  const occurrenceIds = targets.occurrenceIds ?? [];
  if (!todoIds.length && !occurrenceIds.length) return;
  await manager
    .getRepository(FocusBlockEntity)
    .createQueryBuilder()
    .update()
    .set({ endedAt: at, endReason: 'completed' })
    .where('"userId" = :userId', { userId })
    .andWhere('"endedAt" IS NULL')
    .andWhere(
      new Brackets((query) => {
        if (todoIds.length)
          query.orWhere('"todoId" = ANY(:todoIds)', { todoIds });
        if (occurrenceIds.length)
          query.orWhere('"occurrenceId" = ANY(:occurrenceIds)', {
            occurrenceIds,
          });
      }),
    )
    .execute();
}
