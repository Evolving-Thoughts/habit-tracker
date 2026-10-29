import { BadRequestException } from '@nestjs/common';
import { midnightInTimeZone } from '../../common/date/date-only.utils';
import {
  addDays as addCalendarDays,
  daysBetween,
  dayOf,
  weekdayOf,
} from '../../common/date/local-day';
import { ScheduleDto } from '../dto/schedule.dto';
import { ScheduleRuleResponse } from '../dto/habit-response.dto';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export type NormalizedSchedule = Pick<
  HabitScheduleVersionEntity,
  | 'type'
  | 'intervalDays'
  | 'weekdays'
  | 'weeklyTarget'
  | 'missedOccurrencePolicy'
>;

export function normalizeSchedule(input: ScheduleDto): NormalizedSchedule {
  const result: NormalizedSchedule = {
    type: input.type,
    intervalDays: null,
    weekdays: null,
    weeklyTarget: null,
    missedOccurrencePolicy:
      input.missedOccurrencePolicy ?? MissedOccurrencePolicy.CARRY_OVER,
  };

  if (
    !Object.values(MissedOccurrencePolicy).includes(
      result.missedOccurrencePolicy,
    )
  ) {
    throw new BadRequestException('Invalid missed occurrence policy');
  }

  switch (input.type) {
    case HabitScheduleType.INTERVAL:
      if (
        input.intervalDays === undefined ||
        !Number.isInteger(input.intervalDays) ||
        input.intervalDays < 1
      ) {
        throw new BadRequestException(
          'Interval schedules require positive integer intervalDays',
        );
      }

      if (input.weekdays !== undefined || input.weeklyTarget !== undefined) {
        throw new BadRequestException(
          'Interval schedules do not accept weekdays or weeklyTarget',
        );
      }

      result.intervalDays = input.intervalDays;
      return result;

    case HabitScheduleType.FIXED_WEEKDAYS:
      if (
        input.weekdays === undefined ||
        input.weekdays.length === 0 ||
        new Set(input.weekdays).size !== input.weekdays.length ||
        input.weekdays.some(
          (weekday) => !Object.values(Weekday).includes(weekday),
        )
      ) {
        throw new BadRequestException(
          'Fixed-weekday schedules require unique valid weekdays',
        );
      }

      if (
        input.intervalDays !== undefined ||
        input.weeklyTarget !== undefined
      ) {
        throw new BadRequestException(
          'Fixed-weekday schedules do not accept intervalDays or weeklyTarget',
        );
      }

      result.weekdays = [...input.weekdays].sort(
        (first, second) =>
          Object.values(Weekday).indexOf(first) -
          Object.values(Weekday).indexOf(second),
      );

      return result;

    case HabitScheduleType.WEEKLY_TARGET:
      if (
        input.weeklyTarget === undefined ||
        !Number.isInteger(input.weeklyTarget) ||
        input.weeklyTarget < 1 ||
        input.weeklyTarget > 7
      ) {
        throw new BadRequestException(
          'Weekly-target schedules require weeklyTarget between 1 and 7',
        );
      }

      if (
        input.intervalDays !== undefined ||
        input.weekdays !== undefined ||
        input.missedOccurrencePolicy !== undefined
      ) {
        throw new BadRequestException(
          'Weekly-target schedules only accept weeklyTarget',
        );
      }

      result.weeklyTarget = input.weeklyTarget;
      result.missedOccurrencePolicy = MissedOccurrencePolicy.SKIP;
      return result;

    default:
      throw new BadRequestException('Invalid schedule type');
  }
}

export function buildVersion(
  habitId: number,
  definition: NormalizedSchedule,
  effectiveAt: Date,
): HabitScheduleVersionEntity {
  const version = Object.assign(new HabitScheduleVersionEntity(), {
    habitId,
    ...definition,
    weekdays: definition.weekdays === null ? null : [...definition.weekdays],
    effectiveAt: new Date(effectiveAt),
    endsAt: null,
    cancelledAt: null,
    firstDueDate:
      definition.type === HabitScheduleType.INTERVAL
        ? dayOf(effectiveAt)
        : null,
  });

  // Prüft auch, ob sich der nächste Termin im unterstützten
  // Datumsbereich berechnen lässt.
  if (version.type !== HabitScheduleType.WEEKLY_TARGET) {
    const first = nextScheduledDate(version, null);
    nextScheduledDate(version, first);
  }

  return version;
}

export function sameSchedule(
  version: HabitScheduleVersionEntity,
  definition: NormalizedSchedule,
): boolean {
  return (
    version.type === definition.type &&
    version.intervalDays === definition.intervalDays &&
    JSON.stringify(version.weekdays) === JSON.stringify(definition.weekdays) &&
    version.weeklyTarget === definition.weeklyTarget &&
    version.missedOccurrencePolicy === definition.missedOccurrencePolicy
  );
}

function addDays(date: string, days: number): string {
  try {
    return addCalendarDays(date, days);
  } catch {
    throw new BadRequestException(
      'Schedule date is outside the supported calendar range',
    );
  }
}

export function nextScheduledDate(
  version: HabitScheduleVersionEntity,
  afterDate: string | null,
): string {
  if (version.type === HabitScheduleType.INTERVAL) {
    if (version.firstDueDate === null || version.intervalDays === null) {
      throw new BadRequestException('Incomplete interval schedule');
    }

    return afterDate === null
      ? version.firstDueDate
      : addDays(afterDate, version.intervalDays);
  }

  if (
    version.type !== HabitScheduleType.FIXED_WEEKDAYS ||
    version.weekdays === null ||
    version.weekdays.length === 0
  ) {
    throw new BadRequestException('Incomplete fixed-weekday schedule');
  }

  let candidate =
    afterDate === null ? dayOf(version.effectiveAt) : addDays(afterDate, 1);

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (version.weekdays.includes(weekdayOf(candidate))) {
      return candidate;
    }

    candidate = addDays(candidate, 1);
  }

  throw new BadRequestException('Could not calculate scheduled date');
}

/**
 * Whether `date` is a slot of the version, computed directly (no replay of
 * generation history). Must agree with iterating nextScheduledDate; the
 * spec cross-checks both. Weekly-target versions have no fixed slots.
 */
export function isScheduledOn(
  version: HabitScheduleVersionEntity,
  date: string,
): boolean {
  if (date < dayOf(version.effectiveAt)) return false;
  if (version.type === HabitScheduleType.INTERVAL) {
    if (
      !version.firstDueDate ||
      !version.intervalDays ||
      date < version.firstDueDate
    )
      return false;
    return daysBetween(version.firstDueDate, date) % version.intervalDays === 0;
  }
  return (
    version.type === HabitScheduleType.FIXED_WEEKDAYS &&
    (version.weekdays ?? []).includes(weekdayOf(date))
  );
}

/** The latest slot of the version on or before `date`, or null. */
export function latestSlotOnOrBefore(
  version: HabitScheduleVersionEntity,
  date: string,
): string | null {
  if (isScheduledOn(version, date)) return date;
  if (
    version.type === HabitScheduleType.INTERVAL &&
    version.firstDueDate &&
    version.intervalDays &&
    date >= version.firstDueDate
  ) {
    const elapsed = daysBetween(version.firstDueDate, date);
    const slot = addDays(date, -(elapsed % version.intervalDays));
    return isScheduledOn(version, slot) ? slot : null;
  }
  for (let offset = 1; offset <= 6; offset++) {
    const previous = addDays(date, -offset);
    if (isScheduledOn(version, previous)) return previous;
  }
  return null;
}

export function expiresAt(
  version: HabitScheduleVersionEntity,
  scheduledDate: string,
): Date {
  const expiryDate =
    version.type === HabitScheduleType.WEEKLY_TARGET ||
    version.missedOccurrencePolicy === MissedOccurrencePolicy.SKIP
      ? addDays(scheduledDate, 1)
      : nextScheduledDate(version, scheduledDate);

  return midnightInTimeZone(expiryDate);
}

export function slotStartsAt(
  version: HabitScheduleVersionEntity,
  scheduledDate: string,
): Date {
  const midnight = midnightInTimeZone(scheduledDate);

  return new Date(Math.max(midnight.getTime(), version.effectiveAt.getTime()));
}

export function ruleResponse(
  version: HabitScheduleVersionEntity,
): ScheduleRuleResponse {
  switch (version.type) {
    case HabitScheduleType.INTERVAL:
      if (version.intervalDays === null) {
        throw new Error('Missing intervalDays');
      }

      return {
        type: version.type,
        intervalDays: version.intervalDays,
        missedOccurrencePolicy: version.missedOccurrencePolicy,
      };

    case HabitScheduleType.FIXED_WEEKDAYS:
      if (version.weekdays === null) {
        throw new Error('Missing weekdays');
      }

      return {
        type: version.type,
        weekdays: [...version.weekdays],
        missedOccurrencePolicy: version.missedOccurrencePolicy,
      };

    case HabitScheduleType.WEEKLY_TARGET:
      if (version.weeklyTarget === null) {
        throw new Error('Missing weeklyTarget');
      }

      return {
        type: version.type,
        weeklyTarget: version.weeklyTarget,
      };
  }
}
