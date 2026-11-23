import { Brackets, EntityManager, IsNull } from 'typeorm';
import {
  FocusBlockEntity,
  FocusBlockSettingsEntity,
} from './focus-block.entities';
import {
  blockApplies,
  DEFAULT_THRESHOLD_MINUTES,
  hardcoreEndsAt,
  lapsedReason,
  lapsesAt,
  type FocusBlockMode,
  type FocusBlockOverride,
  type FocusListMode,
} from './focus-block-rules';

/**
 * Reading and writing block sessions inside a caller's transaction. No Nest
 * dependencies, so the stopwatch (`timer-target.ts`), quests and dailies can
 * start and end blocks in the same transaction as their own change without
 * module cycles. Callers hold the per-user unit of work (`UserUnitOfWork`).
 */

export type FocusSettings = {
  enabled: boolean;
  thresholdMinutes: number;
  mode: FocusBlockMode;
  listMode: FocusListMode;
};

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  enabled: false,
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
  const { enabled, thresholdMinutes, mode, listMode } = row;
  return { enabled, thresholdMinutes, mode, listMode };
}

/**
 * The person's open block, or null. A block past its moment (Hardcore at
 * its Soll, Soft after 12 hours) is closed here with that moment, so every
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
 * Starts a block for the stopwatch the Fokus-Modus just started or resumed,
 * when its quest or daily calls for one (`blockApplies`). An open block
 * stays as it is. Hardcore needs a Soll still ahead; without one the block
 * starts as Soft (the Fokus screen says so).
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
  const wanted = start.mode ?? settings.mode;
  const endsAt =
    wanted === 'hardcore'
      ? hardcoreEndsAt(start.targetMinutes, start.elapsedMilliseconds, now)
      : null;
  return manager.save(
    FocusBlockEntity,
    manager.create(FocusBlockEntity, {
      userId,
      todoId: 'todoId' in start.target ? start.target.todoId : null,
      occurrenceId:
        'occurrenceId' in start.target ? start.target.occurrenceId : null,
      title: start.title,
      mode: endsAt ? 'hardcore' : 'soft',
      listMode: settings.listMode,
      startedAt: now,
      endsAt,
      endedAt: null,
      endReason: null,
    }),
  );
}

/**
 * The stopwatch ended: an open Soft block ends with it. Hardcore stays
 * until its Soll moment or until its quest or run is done.
 */
export async function endSoftFocusBlocks(
  manager: EntityManager,
  userId: string,
  at: Date,
): Promise<void> {
  await manager
    .getRepository(FocusBlockEntity)
    .createQueryBuilder()
    .update()
    .set({ endedAt: at, endReason: 'stopwatch_stopped' })
    .where('"userId" = :userId', { userId })
    .andWhere('"endedAt" IS NULL')
    .andWhere(`"mode" = 'soft'`)
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
