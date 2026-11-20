import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { ScheduleDto } from './dto/schedule.dto';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { buildVersion, normalizeSchedule } from './scheduling/schedule-rules';
import { habitStreak } from './streaks';

// Friday 2026-11-20, 11:00 in Berlin.
const NOW = new Date('2026-11-20T10:00:00.000Z');

const version = (
  id: number,
  schedule: ScheduleDto,
  effectiveAt = new Date('2026-10-31T23:00:00.000Z'),
  overrides: Partial<HabitScheduleVersionEntity> = {},
): HabitScheduleVersionEntity =>
  Object.assign(buildVersion(1, normalizeSchedule(schedule), effectiveAt), {
    id,
    endsAt: null,
    cancelledAt: null,
    ...overrides,
  });

const daily = (policy: 'skip' | 'carry_over' = 'skip') =>
  version(1, {
    type: 'interval',
    intervalDays: 1,
    missedOccurrencePolicy: policy,
  } as ScheduleDto);

const run = (
  scheduledDate: string,
  status: Status,
  resolvedDate: string | null = status === Status.PENDING
    ? null
    : scheduledDate,
  scheduleVersionId = 1,
) => ({ scheduleVersionId, scheduledDate, status, resolvedDate });

const done = (day: string) => run(day, Status.COMPLETED);
/** Skipped by hand on its day, while it could still be done. */
const skipped = (day: string) => run(day, Status.SKIPPED);
/** Skipped by the scheduler once its window was over: missed. */
const missed = (day: string, noticed: string) =>
  run(day, Status.SKIPPED, noticed);

describe('habitStreak', () => {
  it('counts completed runs in a row up to today', () => {
    expect(
      habitStreak(
        [daily()],
        [done('2026-11-17'), done('2026-11-18'), done('2026-11-19')],
        NOW,
      ),
    ).toMatchObject({ current: 3, best: 3 });
  });

  it("does not break on today's open run", () => {
    expect(
      habitStreak(
        [daily()],
        [
          done('2026-11-18'),
          done('2026-11-19'),
          run('2026-11-20', Status.PENDING),
        ],
        NOW,
      ),
    ).toMatchObject({ current: 2, best: 2 });
  });

  it('breaks on a missed run and keeps the best', () => {
    expect(
      habitStreak(
        [daily()],
        [
          done('2026-11-14'),
          done('2026-11-15'),
          done('2026-11-16'),
          missed('2026-11-17', '2026-11-18'),
          done('2026-11-18'),
          done('2026-11-19'),
        ],
        NOW,
      ),
    ).toMatchObject({ current: 2, best: 3 });
  });

  it('neither counts nor breaks a run skipped by hand', () => {
    expect(
      habitStreak(
        [daily()],
        [done('2026-11-17'), skipped('2026-11-18'), done('2026-11-19')],
        NOW,
      ),
    ).toMatchObject({ current: 2, best: 2 });
  });

  it('treats a stale open run whose window is over as missed', () => {
    expect(
      habitStreak(
        [daily()],
        [
          done('2026-11-17'),
          run('2026-11-18', Status.PENDING),
          done('2026-11-19'),
        ],
        NOW,
      ),
    ).toMatchObject({ current: 1, best: 1 });
  });

  it('keeps a carried-over run open within its window', () => {
    const everyThird = version(1, {
      type: 'interval',
      intervalDays: 3,
      missedOccurrencePolicy: 'carry_over',
    } as ScheduleDto);
    // Slots 11-13, 11-16, 11-19: the run of the 19th may wait until the 21st.
    expect(
      habitStreak(
        [everyThird],
        [
          done('2026-11-13'),
          done('2026-11-16'),
          run('2026-11-19', Status.PENDING),
        ],
        NOW,
      ),
    ).toMatchObject({ current: 2, best: 2 });
  });

  it('tells a hand skip within a carry-over window from a missed run', () => {
    const everyThird = version(1, {
      type: 'interval',
      intervalDays: 3,
      missedOccurrencePolicy: 'carry_over',
    } as ScheduleDto);
    expect(
      habitStreak(
        [everyThird],
        [
          done('2026-11-10'),
          // Skipped by hand two days after its slot, still in its window.
          run('2026-11-13', Status.SKIPPED, '2026-11-15'),
          done('2026-11-16'),
        ],
        NOW,
      ).current,
    ).toBe(2);
    expect(
      habitStreak(
        [everyThird],
        [
          done('2026-11-10'),
          // Its window closed with the next slot on the 16th.
          run('2026-11-13', Status.SKIPPED, '2026-11-16'),
          done('2026-11-16'),
        ],
        NOW,
      ).current,
    ).toBe(1);
  });

  it('ignores cancelled runs', () => {
    expect(
      habitStreak(
        [daily()],
        [done('2026-11-18'), run('2026-11-19', Status.CANCELLED, '2026-11-19')],
        NOW,
      ),
    ).toMatchObject({ current: 1, best: 1 });
  });

  it('counts completed runs at their slot, even when done late', () => {
    expect(
      habitStreak(
        [daily('carry_over')],
        [run('2026-11-18', Status.COMPLETED, '2026-11-19'), done('2026-11-19')],
        NOW,
      ),
    ).toMatchObject({ current: 2, best: 2 });
  });

  it('is empty without runs', () => {
    expect(habitStreak([daily()], [], NOW)).toEqual({
      current: 0,
      best: 0,
      unit: 'runs',
    });
  });

  describe('a weekly goal counts weeks', () => {
    const weekly = (effectiveAt = new Date('2026-10-25T23:00:00.000Z')) =>
      version(
        2,
        { type: 'weekly_target', weeklyTarget: 2 } as ScheduleDto,
        effectiveAt,
      );
    const target = (day: string, status: Status, resolved?: string | null) =>
      run(
        day,
        status,
        resolved === undefined
          ? status === Status.PENDING
            ? null
            : day
          : resolved,
        2,
      );

    it('counts weeks that met the goal; the running week breaks nothing', () => {
      // Weeks from 10-26, 11-02, 11-09 and 11-16 (this one, not met yet).
      expect(
        habitStreak(
          [weekly()],
          [
            target('2026-10-27', Status.COMPLETED),
            target('2026-10-29', Status.COMPLETED),
            target('2026-11-03', Status.COMPLETED),
            target('2026-11-05', Status.COMPLETED),
            target('2026-11-10', Status.COMPLETED),
            target('2026-11-11', Status.SKIPPED, '2026-11-12'),
            target('2026-11-12', Status.COMPLETED),
            target('2026-11-20', Status.PENDING),
          ],
          NOW,
        ),
      ).toMatchObject({ current: 3, best: 3 });
    });

    it('breaks on a past week below the goal', () => {
      expect(
        habitStreak(
          [weekly()],
          [
            target('2026-10-27', Status.COMPLETED),
            target('2026-10-29', Status.COMPLETED),
            target('2026-11-03', Status.COMPLETED),
            target('2026-11-04', Status.SKIPPED, '2026-11-05'),
            target('2026-11-10', Status.COMPLETED),
            target('2026-11-12', Status.COMPLETED),
          ],
          NOW,
        ),
      ).toMatchObject({ current: 1, best: 1 });
    });

    it('does not break on a first week the goal covered only in part', () => {
      // Begun on Thursday 10-29: that week ends below the goal.
      expect(
        habitStreak(
          [weekly(new Date('2026-10-28T23:00:00.000Z'))],
          [
            target('2026-10-29', Status.COMPLETED),
            target('2026-11-03', Status.COMPLETED),
            target('2026-11-05', Status.COMPLETED),
          ],
          NOW,
        ),
      ).toMatchObject({ current: 1, best: 1 });
    });

    it('counts a running week once its goal is met', () => {
      expect(
        habitStreak(
          [weekly()],
          [
            target('2026-11-16', Status.COMPLETED),
            target('2026-11-18', Status.COMPLETED),
          ],
          NOW,
        ),
      ).toEqual({ current: 1, best: 1, unit: 'weeks' });
    });
  });

  it('carries the series across a change of rhythm', () => {
    const before = version(
      1,
      {
        type: 'interval',
        intervalDays: 1,
        missedOccurrencePolicy: 'skip',
      } as ScheduleDto,
      new Date('2026-10-31T23:00:00.000Z'),
      { endsAt: new Date('2026-11-17T23:00:00.000Z') },
    );
    const after = version(
      3,
      {
        type: 'fixed_weekdays',
        weekdays: ['thursday'],
        missedOccurrencePolicy: 'skip',
      } as ScheduleDto,
      new Date('2026-11-17T23:00:00.000Z'),
    );
    expect(
      habitStreak(
        [before, after],
        [
          done('2026-11-16'),
          done('2026-11-17'),
          run('2026-11-19', Status.COMPLETED, '2026-11-19', 3),
        ],
        NOW,
      ),
    ).toMatchObject({ current: 3, best: 3 });
  });
});
