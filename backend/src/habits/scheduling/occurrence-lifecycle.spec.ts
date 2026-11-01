import { HabitOccurrenceStatus as Status } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { ScheduleDto } from '../dto/schedule.dto';
import { buildVersion, normalizeSchedule } from './schedule-rules';
import {
  activeVersion,
  completedBetween,
  isCompletedOn,
  lifecycleChanges,
} from './occurrence-lifecycle';

const NOW = new Date('2026-10-30T10:00:00.000Z');
const ACTIVE = { isActive: true };

const version = (
  schedule: ScheduleDto,
  overrides: Partial<HabitScheduleVersionEntity> = {},
): HabitScheduleVersionEntity =>
  Object.assign(
    buildVersion(
      1,
      normalizeSchedule(schedule),
      new Date('2026-10-30T00:00:00.000Z'),
    ),
    { id: 1, endsAt: null, cancelledAt: null, ...overrides },
  );

const daily = (overrides?: Partial<HabitScheduleVersionEntity>) =>
  version(
    {
      type: 'interval',
      intervalDays: 1,
      missedOccurrencePolicy: 'skip',
    } as ScheduleDto,
    overrides,
  );

const occurrence = (
  scheduledDate: string,
  status = Status.PENDING,
  resolvedDate: string | null = null,
) => ({ scheduleVersionId: 1, scheduledDate, status, resolvedDate });

describe('occurrence lifecycle', () => {
  it('creates the pending run of a due slot', () => {
    expect(lifecycleChanges(ACTIVE, [daily()], [], NOW).create).toEqual([
      expect.objectContaining({
        scheduledDate: '2026-10-30',
        status: Status.PENDING,
      }),
    ]);
  });

  it('skips a run whose window is over', () => {
    const stale = occurrence('2026-10-20');
    const { resolve } = lifecycleChanges(ACTIVE, [daily()], [stale], NOW);
    expect(resolve).toEqual([
      {
        occurrence: stale,
        resolution: {
          status: Status.SKIPPED,
          resolvedDate: '2026-10-30',
          cancellationReason: null,
        },
      },
    ]);
  });

  it('leaves the runs of a paused habit alone', () => {
    const { resolve, create } = lifecycleChanges(
      { isActive: false },
      [daily()],
      [occurrence('2026-10-20')],
      NOW,
    );
    expect(resolve).toEqual([]);
    expect(create).toEqual([]);
  });

  it('cancels a run cut off by a schedule change', () => {
    const endsAt = new Date('2026-10-30T08:00:00.000Z');
    const [change] = lifecycleChanges(
      ACTIVE,
      [daily({ endsAt })],
      [occurrence('2026-10-30')],
      NOW,
    ).resolve;
    expect(change.resolution).toEqual({
      status: Status.CANCELLED,
      resolvedDate: '2026-10-30',
      cancellationReason: 'schedule_changed',
    });
  });

  it('cancels a new slot on a day that is already completed', () => {
    const done = occurrence('2026-10-29', Status.COMPLETED, '2026-10-30');
    const { create } = lifecycleChanges(ACTIVE, [daily()], [done], NOW);
    expect(create[0]).toMatchObject({
      status: Status.CANCELLED,
      cancellationReason: 'already_completed_today',
    });
  });

  it('refuses overlapping versions', () => {
    expect(() =>
      lifecycleChanges(ACTIVE, [daily(), daily({ id: 2 })], [], NOW),
    ).toThrow('Overlapping');
  });

  it('counts completions per day and range', () => {
    const done = occurrence('2026-10-29', Status.COMPLETED, '2026-10-30');
    expect(isCompletedOn(done, '2026-10-30')).toBe(true);
    expect(isCompletedOn(done, '2026-10-29')).toBe(false);
    expect(completedBetween([done], '2026-10-26', '2026-10-30')).toBe(1);
    expect(completedBetween([done], '2026-10-31', '2026-11-01')).toBe(0);
  });

  it('finds the version active at a moment', () => {
    const closed = daily({ endsAt: new Date('2026-10-30T08:00:00.000Z') });
    expect(activeVersion([closed], NOW)).toBeUndefined();
    expect(activeVersion([daily()], NOW)?.id).toBe(1);
  });
});
