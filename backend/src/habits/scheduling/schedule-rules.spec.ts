import { midnightInTimeZone } from '../../common/date/date-only.utils';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';
import {
  buildVersion,
  expiresAt,
  nextScheduledDate,
  normalizeSchedule,
  sameSchedule,
  slotStartsAt,
} from './schedule-rules';

describe('schedule rules', () => {
  const effectiveAt = midnightInTimeZone('2026-10-01');

  it('creates an interval anchored to its effective day', () => {
    const definition = normalizeSchedule({
      type: HabitScheduleType.INTERVAL,
      intervalDays: 2,
    });

    const version = buildVersion(1, definition, effectiveAt);

    expect(version.firstDueDate).toBe('2026-10-01');
    expect(nextScheduledDate(version, null)).toBe('2026-10-01');
    expect(nextScheduledDate(version, '2026-10-01')).toBe('2026-10-03');
  });

  it('expires carry-over at the next interval date', () => {
    const version = buildVersion(
      1,
      normalizeSchedule({
        type: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      }),
      effectiveAt,
    );

    expect(expiresAt(version, '2026-10-01')).toEqual(
      midnightInTimeZone('2026-10-03'),
    );
  });

  it('expires SKIP at the next calendar day', () => {
    const version = buildVersion(
      1,
      normalizeSchedule({
        type: HabitScheduleType.INTERVAL,
        intervalDays: 2,
        missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
      }),
      effectiveAt,
    );

    expect(expiresAt(version, '2026-10-01')).toEqual(
      midnightInTimeZone('2026-10-02'),
    );
  });

  it('orders weekdays from Monday onward', () => {
    const definition = normalizeSchedule({
      type: HabitScheduleType.FIXED_WEEKDAYS,
      weekdays: [Weekday.THURSDAY, Weekday.MONDAY],
    });

    expect(definition.weekdays).toEqual([Weekday.MONDAY, Weekday.THURSDAY]);
  });

  it('finds configured weekdays', () => {
    const version = buildVersion(
      1,
      normalizeSchedule({
        type: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      }),
      effectiveAt,
    );

    expect(nextScheduledDate(version, null)).toBe('2026-10-01');
    expect(nextScheduledDate(version, '2026-10-01')).toBe('2026-10-05');
  });

  it('compares normalized schedules', () => {
    const first = normalizeSchedule({
      type: HabitScheduleType.FIXED_WEEKDAYS,
      weekdays: [Weekday.THURSDAY, Weekday.MONDAY],
    });

    const second = normalizeSchedule({
      type: HabitScheduleType.FIXED_WEEKDAYS,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
    });

    expect(sameSchedule(buildVersion(1, first, effectiveAt), second)).toBe(
      true,
    );
  });

  it('uses the activation time for a same-day first slot', () => {
    const activation = new Date('2026-10-01T12:00:00Z');

    const version = buildVersion(
      1,
      normalizeSchedule({
        type: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      }),
      activation,
    );

    expect(slotStartsAt(version, '2026-10-01')).toEqual(activation);
  });

  it('rejects parameters of another schedule type', () => {
    expect(() =>
      normalizeSchedule({
        type: HabitScheduleType.INTERVAL,
        intervalDays: 2,
        weekdays: [Weekday.MONDAY],
      }),
    ).toThrow();
  });

  it('rejects duplicate weekdays', () => {
    expect(() =>
      normalizeSchedule({
        type: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY, Weekday.MONDAY],
      }),
    ).toThrow();
  });

  it('does not accept a missed policy for weekly targets', () => {
    expect(() =>
      normalizeSchedule({
        type: HabitScheduleType.WEEKLY_TARGET,
        weeklyTarget: 3,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      }),
    ).toThrow();
  });
});
