import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';

export type WeekQuota = {
  completed: number;
  total: number;
  percentage: number;
};

export type QuotaOccurrence = {
  status: Status;
  scheduleVersionId: number;
  scheduleVersion: { type: HabitScheduleType; weeklyTarget: number | null };
};

/**
 * Share of the week's stored habit occurrences that was completed. Skips count
 * as not completed; cancelled ones and paused times have no occurrence that
 * counts. A weekly target stores one skippable occurrence per day, so there
 * the target itself is the denominator. Null when nothing was planned.
 */
export function weekQuota(occurrences: QuotaOccurrence[]): WeekQuota | null {
  let completed = 0;
  let total = 0;
  const weekly = new Map<number, { done: number; target: number }>();
  for (const item of occurrences) {
    const done = item.status === Status.COMPLETED ? 1 : 0;
    if (item.status === Status.CANCELLED) continue;
    if (item.scheduleVersion.type === HabitScheduleType.WEEKLY_TARGET) {
      const entry = weekly.get(item.scheduleVersionId) ?? {
        done: 0,
        target: item.scheduleVersion.weeklyTarget ?? 0,
      };
      entry.done += done;
      weekly.set(item.scheduleVersionId, entry);
    } else {
      completed += done;
      total += 1;
    }
  }
  for (const { done, target } of weekly.values()) {
    completed += done;
    total += Math.max(done, target);
  }
  if (total === 0) return null;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}
