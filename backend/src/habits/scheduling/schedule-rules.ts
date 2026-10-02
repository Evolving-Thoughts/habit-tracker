import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_TIME_ZONE,
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from '../../common/date/date-only.utils';
import { HabitScheduleCalculator } from '../../habit-occurrences/scheduling/habit-schedule-calculator';
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
        ? getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, effectiveAt)
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
    const result = HabitScheduleCalculator.addDays(date, days);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      throw new Error('Unsupported date');
    }

    return result;
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
    afterDate === null
      ? getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, version.effectiveAt)
      : addDays(afterDate, 1);

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (HabitScheduleCalculator.isFixedWeekday(candidate, version.weekdays)) {
      return candidate;
    }

    candidate = addDays(candidate, 1);
  }

  throw new BadRequestException('Could not calculate scheduled date');
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
