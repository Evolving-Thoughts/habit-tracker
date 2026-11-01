import { ConflictException } from '@nestjs/common';
import { dayOf, weekRange } from '../../common/date/local-day';
import { HabitOccurrenceCancellationReason } from '../../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { expiresAt, nextScheduledDate, slotStartsAt } from './schedule-rules';

/**
 * Decides what happens to a habit's occurrences at a point in time. Nothing
 * here touches the database: the scheduler stores the result, the history
 * forecast reads the same rules.
 */
type Occurrence = {
  scheduleVersionId: number;
  scheduledDate: string;
  status: Status;
  resolvedDate: string | null;
};

export type Resolution = {
  status: Status;
  resolvedDate: string | null;
  cancellationReason: HabitOccurrenceCancellationReason | null;
};

export type LifecycleChanges<T extends Occurrence> = {
  resolve: { occurrence: T; resolution: Resolution }[];
  create: ({ scheduleVersionId: number; scheduledDate: string } & Resolution)[];
};

const MAX_SLOTS_PER_RUN = 10000;

const resolved = (
  status: Status,
  resolvedDate: string | null,
  cancellationReason: Resolution['cancellationReason'] = null,
): Resolution => ({ status, resolvedDate, cancellationReason });

export function isCompletedOn(
  occurrence: { status: Status; resolvedDate: string | null },
  day: string,
): boolean {
  return (
    occurrence.status === Status.COMPLETED && occurrence.resolvedDate === day
  );
}

/** Completions resolved within the days, under any version of the habit. */
export function completedBetween(
  occurrences: { status: Status; resolvedDate: string | null }[],
  firstDay: string,
  lastDay: string,
): number {
  return occurrences.filter(
    ({ status, resolvedDate }) =>
      status === Status.COMPLETED &&
      resolvedDate !== null &&
      firstDay <= resolvedDate &&
      resolvedDate <= lastDay,
  ).length;
}

export function activeVersion(
  versions: HabitScheduleVersionEntity[],
  at: Date,
): HabitScheduleVersionEntity | undefined {
  const matching = versions.filter(
    (version) =>
      version.cancelledAt === null &&
      version.effectiveAt <= at &&
      (version.endsAt === null || at < version.endsAt),
  );
  if (matching.length > 1)
    throw new ConflictException('Overlapping schedule versions');
  return matching[0];
}

function assertNoOverlap(versions: HabitScheduleVersionEntity[]): void {
  for (let index = 1; index < versions.length; index += 1) {
    const previous = versions[index - 1];
    if (
      previous.endsAt === null ||
      previous.endsAt > versions[index].effectiveAt
    )
      throw new ConflictException('Overlapping schedule versions');
  }
}

const isClosed = (version: HabitScheduleVersionEntity, now: Date): boolean =>
  version.endsAt !== null && version.endsAt <= now;

/** How a slot ended by now: run out, or cut off by a schedule change. */
function endedSlot(
  version: HabitScheduleVersionEntity,
  scheduledDate: string,
  now: Date,
): Resolution | null {
  const expiry = expiresAt(version, scheduledDate);
  const today = dayOf(now);
  if (version.endsAt !== null && isClosed(version, now))
    return expiry <= version.endsAt
      ? resolved(Status.SKIPPED, today)
      : resolved(Status.CANCELLED, dayOf(version.endsAt), 'schedule_changed');
  return expiry <= now ? resolved(Status.SKIPPED, today) : null;
}

/** Everything that has to change so the occurrences match `now`. */
export function lifecycleChanges<T extends Occurrence>(
  habit: { isActive: boolean },
  versions: HabitScheduleVersionEntity[],
  occurrences: T[],
  now: Date,
): LifecycleChanges<T> {
  const today = dayOf(now);
  const usable = versions.filter((version) => version.cancelledAt === null);
  assertNoOverlap(usable);

  const byId = new Map(versions.map((version) => [version.id, version]));
  const changes: LifecycleChanges<T> = { resolve: [], create: [] };
  // The state after the changes so far: later rules build on earlier ones.
  const current: Occurrence[] = occurrences.map((occurrence) => {
    const version = byId.get(occurrence.scheduleVersionId);
    if (!version)
      throw new ConflictException('Occurrence has an invalid version');
    if (occurrence.status !== Status.PENDING) return occurrence;
    const ended = endedSlot(version, occurrence.scheduledDate, now);
    if (!ended || !(habit.isActive || isClosed(version, now)))
      return occurrence;
    changes.resolve.push({ occurrence, resolution: ended });
    return { ...occurrence, ...ended };
  });
  if (!habit.isActive) return changes;

  const create = (
    scheduleVersionId: number,
    scheduledDate: string,
    resolution: Resolution,
  ): void => {
    const created = { scheduleVersionId, scheduledDate, ...resolution };
    changes.create.push(created);
    current.push(created);
  };

  for (const version of usable) {
    if (
      version.effectiveAt > now ||
      version.type === HabitScheduleType.WEEKLY_TARGET
    )
      continue;
    let candidate = nextScheduledDate(version, null);
    for (
      let examined = 1;
      candidate <= today &&
      (version.endsAt === null ||
        slotStartsAt(version, candidate) < version.endsAt);
      examined += 1
    ) {
      if (examined > MAX_SLOTS_PER_RUN)
        throw new ConflictException(
          'Too many historical slots for one generation run',
        );
      const date = candidate;
      const known = current.some(
        (item) =>
          item.scheduleVersionId === version.id && item.scheduledDate === date,
      );
      if (!known)
        create(
          version.id,
          date,
          endedSlot(version, date, now) ??
            (current.some((item) => isCompletedOn(item, today))
              ? resolved(Status.CANCELLED, today, 'already_completed_today')
              : resolved(Status.PENDING, null)),
        );
      candidate = nextScheduledDate(version, candidate);
    }
  }

  const active = activeVersion(versions, now);
  if (active?.type !== HabitScheduleType.WEEKLY_TARGET) return changes;

  const pending = current.find((item) => item.status === Status.PENDING);
  const week = weekRange(today);
  if (
    active.weeklyTarget !== null &&
    completedBetween(current, week.startDate, today) >= active.weeklyTarget
  ) {
    const stored = occurrences.find((item) => item === pending);
    if (stored)
      changes.resolve.push({
        occurrence: stored,
        resolution: resolved(Status.CANCELLED, today, 'weekly_target_reached'),
      });
    return changes;
  }
  const taken =
    pending !== undefined ||
    current.some(
      (item) =>
        isCompletedOn(item, today) ||
        (item.scheduleVersionId === active.id && item.scheduledDate === today),
    );
  if (!taken) create(active.id, today, resolved(Status.PENDING, null));
  return changes;
}
