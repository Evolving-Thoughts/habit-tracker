import { HabitEntity } from '../entities/habit.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';
import { createInitialScheduleVersion } from './create-initial-schedule-version';

type InitialHabitSchedule = Pick<
  HabitEntity,
  | 'id'
  | 'scheduleType'
  | 'startDate'
  | 'intervalDays'
  | 'weekdays'
  | 'weeklyTarget'
  | 'missedOccurrencePolicy'
>;

function makeHabit(
  overrides: Partial<InitialHabitSchedule> = {},
): InitialHabitSchedule {
  return {
    id: 1,
    scheduleType: HabitScheduleType.INTERVAL,
    startDate: '2026-10-02',
    intervalDays: 2,
    weekdays: null,
    weeklyTarget: null,
    missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    ...overrides,
  };
}

describe('createInitialScheduleVersion', () => {
  it('creates an interval version anchored to the habit start date', () => {
    const habit = makeHabit();

    const version = createInitialScheduleVersion(habit);

    expect(version).toMatchObject({
      habitId: 1,
      scheduleType: HabitScheduleType.INTERVAL,
      validFrom: '2026-10-02',
      validUntil: null,
      firstDueDate: '2026-10-02',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    });

    expect(version.id).toBeUndefined();
    expect(version.createdAt).toBeUndefined();
  });

  it('creates a fixed-weekday version without an interval anchor', () => {
    const habit = makeHabit({
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      intervalDays: null,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
    });

    const version = createInitialScheduleVersion(habit);

    expect(version).toMatchObject({
      habitId: 1,
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      validFrom: '2026-10-02',
      validUntil: null,
      firstDueDate: null,
      intervalDays: null,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
    });
  });

  it('creates a weekly-target version', () => {
    const habit = makeHabit({
      scheduleType: HabitScheduleType.WEEKLY_TARGET,
      intervalDays: null,
      weeklyTarget: 3,
    });

    const version = createInitialScheduleVersion(habit);

    expect(version).toMatchObject({
      habitId: 1,
      scheduleType: HabitScheduleType.WEEKLY_TARGET,
      validFrom: '2026-10-02',
      validUntil: null,
      firstDueDate: null,
      intervalDays: null,
      weekdays: null,
      weeklyTarget: 3,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    });
  });

  it('copies weekdays instead of sharing the original array', () => {
    const weekdays = [Weekday.MONDAY, Weekday.THURSDAY];

    const habit = makeHabit({
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      intervalDays: null,
      weekdays,
    });

    const version = createInitialScheduleVersion(habit);

    expect(version.weekdays).toEqual(weekdays);
    expect(version.weekdays).not.toBe(weekdays);

    weekdays.push(Weekday.FRIDAY);

    expect(version.weekdays).toEqual([Weekday.MONDAY, Weekday.THURSDAY]);
  });
});
