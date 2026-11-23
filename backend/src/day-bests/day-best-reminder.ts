import type { EntityManager } from 'typeorm';
import { dayOf } from '../common/date/local-day';
import {
  DayBestEntity,
  DayBestSettingsEntity,
  DEFAULT_CARD_MINUTES,
} from './day-best.entities';
import type { ReminderState } from './day-best-rules';

/**
 * What the push side reads and writes about the evening reminder, inside
 * its own user lock. The rule itself is `reminderDecision`.
 */

/** Today's reminder state of one person, defaults where nothing is stored. */
export async function loadReminderState(
  manager: EntityManager,
  userId: string,
  day: string,
): Promise<ReminderState> {
  const settings = await manager.findOneBy(DayBestSettingsEntity, { userId });
  const hasEntry = await manager.existsBy(DayBestEntity, { userId, date: day });
  return {
    cardMinutes: settings?.cardMinutes ?? DEFAULT_CARD_MINUTES,
    reminderEnabled: settings?.reminderEnabled ?? true,
    remindedOn: settings?.remindedOn ?? null,
    hasEntry,
  };
}

/** The reminder of `day` is handled: it is not looked at again that day. */
export async function markReminded(
  manager: EntityManager,
  userId: string,
  day: string,
): Promise<void> {
  await manager.upsert(DayBestSettingsEntity, { userId, remindedOn: day }, [
    'userId',
  ]);
}

/**
 * Whether a queued reminder for `day` should still show: it is still that
 * day, the reminder is on, and the day has no line yet.
 */
export async function reminderStillWanted(
  manager: EntityManager,
  userId: string,
  day: string,
  now: Date,
): Promise<boolean> {
  if (dayOf(now) !== day) return false;
  const state = await loadReminderState(manager, userId, day);
  return state.reminderEnabled && !state.hasEntry;
}
