import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { QuotaOccurrence, weekQuota } from './week-quota';

const interval = (status: Status, version = 1): QuotaOccurrence => ({
  status,
  scheduleVersionId: version,
  scheduleVersion: { type: HabitScheduleType.INTERVAL, weeklyTarget: null },
});
const weekly = (status: Status, target = 3): QuotaOccurrence => ({
  status,
  scheduleVersionId: 9,
  scheduleVersion: {
    type: HabitScheduleType.WEEKLY_TARGET,
    weeklyTarget: target,
  },
});

describe('weekQuota', () => {
  it('has no quota without planned occurrences', () => {
    expect(weekQuota([])).toBeNull();
    expect(weekQuota([interval(Status.CANCELLED)])).toBeNull();
  });

  it('counts skipped and open occurrences as not completed', () => {
    expect(
      weekQuota([
        interval(Status.COMPLETED),
        interval(Status.COMPLETED),
        interval(Status.SKIPPED),
        interval(Status.PENDING),
      ]),
    ).toEqual({ completed: 2, total: 4, percentage: 50 });
  });

  it('measures a weekly target against the target, not its daily rows', () => {
    const week = [
      weekly(Status.COMPLETED),
      weekly(Status.SKIPPED),
      weekly(Status.COMPLETED),
      weekly(Status.SKIPPED),
      weekly(Status.COMPLETED),
      weekly(Status.CANCELLED),
    ];
    expect(weekQuota(week)).toEqual({
      completed: 3,
      total: 3,
      percentage: 100,
    });
    expect(weekQuota(week.slice(0, 3))).toMatchObject({
      completed: 2,
      total: 3,
    });
  });

  it('never exceeds 100 % when a target was beaten', () => {
    expect(
      weekQuota([weekly(Status.COMPLETED, 1), weekly(Status.COMPLETED, 1)]),
    ).toEqual({ completed: 2, total: 2, percentage: 100 });
  });
});
