import { addDays, atWallClockMinutes } from '../common/date/local-day';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { ScheduleDto } from '../habits/dto/schedule.dto';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import {
  buildVersion,
  normalizeSchedule,
} from '../habits/scheduling/schedule-rules';
import {
  challengeTally,
  challengeToday,
  donePercent,
  weeklyDue,
  type ChallengeRun,
  type ChallengeWindow,
} from './challenge-progress';

// November 2026: the 1st is a Sunday, the 30th a Monday.
const NOVEMBER: ChallengeWindow = { first: '2026-11-01', last: '2026-11-30' };
/** Noon in Berlin on `day`. */
const noon = (day: string) => atWallClockMinutes(day, 12 * 60);
const AFTER = noon('2026-12-01');
const ACTIVE = { isActive: true };
const PAUSED = { isActive: false };

const version = (
  schedule: ScheduleDto,
  effectiveFrom = '2026-10-01',
  id = 1,
): HabitScheduleVersionEntity =>
  Object.assign(
    buildVersion(
      1,
      normalizeSchedule(schedule),
      atWallClockMinutes(effectiveFrom, 0),
    ),
    { id, endsAt: null, cancelledAt: null },
  );

const everyDay = (policy: 'skip' | 'carry_over' = 'skip') =>
  version({
    type: 'interval',
    intervalDays: 1,
    missedOccurrencePolicy: policy,
  } as ScheduleDto);

let nextId = 1;
const run = (
  scheduledDate: string,
  status: Status,
  resolvedDate: string | null = status === Status.PENDING
    ? null
    : scheduledDate,
  scheduleVersionId = 1,
): ChallengeRun => ({
  id: nextId++,
  scheduleVersionId,
  scheduledDate,
  movedToDate: null,
  status,
  resolvedDate,
});
const done = (day: string, on = day) => run(day, Status.COMPLETED, on);

/** Every day from `first` to `last`, both included. */
function days(first: string, last: string): string[] {
  const result: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) result.push(day);
  return result;
}

describe('Monats-Challenge: counting a fixed rhythm', () => {
  it('counts every due run of the month once it is over', () => {
    const runs = [
      ...days('2026-11-01', '2026-11-29').map((day) => done(day)),
      run('2026-11-30', Status.SKIPPED, '2026-12-01'),
    ];
    expect(challengeTally([everyDay()], runs, NOVEMBER, AFTER)).toEqual({
      done: 29,
      missed: 1,
      remaining: 0,
    });
    expect(donePercent(29, 30)).toBe(96);
    expect(donePercent(30, 30)).toBe(100);
    expect(donePercent(0, 0)).toBe(0);
  });

  it('counts a run skipped by hand as missed, unlike the series', () => {
    const runs = days('2026-11-01', '2026-11-30').map((day) =>
      day === '2026-11-10' ? run(day, Status.SKIPPED) : done(day),
    );
    expect(challengeTally([everyDay()], runs, NOVEMBER, AFTER)).toEqual({
      done: 29,
      missed: 1,
      remaining: 0,
    });
  });

  it('splits the running month into done, missed and still possible', () => {
    const now = noon('2026-11-12');
    const runs = [
      ...days('2026-11-01', '2026-11-11').map((day) =>
        day === '2026-11-04'
          ? run(day, Status.SKIPPED, '2026-11-05')
          : done(day),
      ),
      run('2026-11-12', Status.PENDING),
    ];
    // Today's open run is still possible, as are the 18 days after it.
    expect(challengeTally([everyDay()], runs, NOVEMBER, now)).toEqual({
      done: 10,
      missed: 1,
      remaining: 19,
    });
    expect(challengeToday([everyDay()], runs, NOVEMBER, now, ACTIVE)).toEqual({
      state: 'open',
      occurrenceId: runs[11].id,
    });

    const ticked = [...runs.slice(0, 11), done('2026-11-12')];
    expect(challengeTally([everyDay()], ticked, NOVEMBER, now)).toEqual({
      done: 11,
      missed: 1,
      remaining: 18,
    });
    expect(challengeToday([everyDay()], ticked, NOVEMBER, now, ACTIVE)).toEqual(
      {
        state: 'done',
      },
    );
  });

  it('counts a past slot without a stored run as missed', () => {
    const runs = days('2026-11-01', '2026-11-09')
      .filter((day) => day !== '2026-11-05')
      .map((day) => done(day));
    expect(
      challengeTally([everyDay()], runs, NOVEMBER, noon('2026-11-10')),
    ).toEqual({ done: 8, missed: 1, remaining: 21 });
  });

  it('counts only the days from a start in mid-month', () => {
    const window = { first: '2026-11-20', last: '2026-11-30' };
    const runs = [
      ...days('2026-11-01', '2026-11-19').map((day) =>
        run(day, Status.SKIPPED),
      ),
      run('2026-11-20', Status.PENDING),
    ];
    expect(
      challengeTally([everyDay()], runs, window, noon('2026-11-20')),
    ).toEqual({ done: 0, missed: 0, remaining: 11 });
  });

  it('follows fixed weekdays', () => {
    const monWedFri = version({
      type: 'fixed_weekdays',
      weekdays: ['monday', 'wednesday', 'friday'],
      missedOccurrencePolicy: 'skip',
    } as ScheduleDto);
    // Mondays 2, 9, 16, 23, 30; Wednesdays 4, 11, 18, 25; Fridays 6, 13, 20, 27.
    const slots = days('2026-11-01', '2026-11-30').filter((day) =>
      [1, 3, 5].includes(new Date(`${day}T12:00:00Z`).getUTCDay()),
    );
    expect(slots).toHaveLength(13);
    expect(
      challengeTally(
        [monWedFri],
        slots.map((day) => done(day)),
        NOVEMBER,
        AFTER,
      ),
    ).toEqual({ done: 13, missed: 0, remaining: 0 });
    // Before anything is stored, the whole month is still possible.
    expect(
      challengeTally([monWedFri], [], NOVEMBER, noon('2026-10-31')),
    ).toEqual({ done: 0, missed: 0, remaining: 13 });
  });

  it('follows every n days from its first due day', () => {
    const everyThird = version(
      {
        type: 'interval',
        intervalDays: 3,
        missedOccurrencePolicy: 'carry_over',
      } as ScheduleDto,
      '2026-11-02',
    );
    // 2, 5, 8, 11, 14, 17, 20, 23, 26, 29.
    expect(challengeTally([everyThird], [], NOVEMBER, AFTER)).toEqual({
      done: 0,
      missed: 10,
      remaining: 0,
    });
  });

  it('leaves cancelled runs out and a run done after the month counts as missed', () => {
    const carry = everyDay('carry_over');
    const runs = [
      run('2026-11-29', Status.CANCELLED, '2026-11-29'),
      done('2026-11-30', '2026-12-01'),
    ];
    expect(
      challengeTally(
        [carry],
        runs,
        { first: '2026-11-29', last: '2026-11-30' },
        AFTER,
      ),
    ).toEqual({ done: 0, missed: 1, remaining: 0 });
  });

  it('counts a run carried over into today as open, until its window closes', () => {
    const everySecond = version(
      {
        type: 'interval',
        intervalDays: 2,
        missedOccurrencePolicy: 'carry_over',
      } as ScheduleDto,
      '2026-11-01',
    );
    const runs = [
      done('2026-11-01'),
      done('2026-11-03'),
      run('2026-11-05', Status.PENDING),
    ];
    const now = noon('2026-11-06');
    expect(challengeToday([everySecond], runs, NOVEMBER, now, ACTIVE)).toEqual({
      state: 'open',
      occurrenceId: runs[2].id,
    });
    // Slots 5, 7, …, 29: 13 still possible, the 5th among them.
    expect(challengeTally([everySecond], runs, NOVEMBER, now)).toEqual({
      done: 2,
      missed: 0,
      remaining: 13,
    });
    expect(
      challengeToday([everySecond], runs, NOVEMBER, noon('2026-11-07'), ACTIVE),
    ).toEqual({ state: 'none' });
  });

  it('offers no run to act on while the Daily is paused, but keeps counting', () => {
    const now = noon('2026-11-12');
    const runs = [
      ...days('2026-11-01', '2026-11-11').map((day) => done(day)),
      run('2026-11-12', Status.PENDING),
    ];
    expect(challengeToday([everyDay()], runs, NOVEMBER, now, PAUSED)).toEqual({
      state: 'none',
    });
    // Pausing excuses nothing: today's run is still possible.
    expect(challengeTally([everyDay()], runs, NOVEMBER, now)).toEqual({
      done: 11,
      missed: 0,
      remaining: 19,
    });
    // A run done before the pause still shows as done.
    const ticked = [...runs.slice(0, 11), done('2026-11-12')];
    expect(challengeToday([everyDay()], ticked, NOVEMBER, now, PAUSED)).toEqual(
      { state: 'done' },
    );
  });

  it('follows a change of rhythm within the month', () => {
    const before = Object.assign(everyDay(), {
      endsAt: atWallClockMinutes('2026-11-16', 0),
    });
    const after = version(
      {
        type: 'fixed_weekdays',
        weekdays: ['monday'],
        missedOccurrencePolicy: 'skip',
      } as ScheduleDto,
      '2026-11-16',
      2,
    );
    // 15 daily runs, then Mondays 16, 23 and 30.
    expect(challengeTally([before, after], [], NOVEMBER, AFTER)).toEqual({
      done: 0,
      missed: 18,
      remaining: 0,
    });
  });
});

describe('Monats-Challenge: counting a weekly target', () => {
  const threeAWeek = (from = '2026-10-01') =>
    version({ type: 'weekly_target', weeklyTarget: 3 } as ScheduleDto, from);

  it('asks for the target in proportion to the days a week covers', () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7].map((covered) => weeklyDue(3, covered)),
    ).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(
      [1, 2, 3, 4, 5, 6, 7].map((covered) => weeklyDue(7, covered)),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([3, 4].map((covered) => weeklyDue(1, covered))).toEqual([0, 1]);
  });

  it('counts each week up to its target once the month is over', () => {
    // Sunday the 1st and Monday the 30th are one day of their weeks: 0 due.
    // The four whole weeks ask for 3 each; a fourth run makes up for nothing.
    const runs = [
      done('2026-11-01'),
      ...['02', '03', '04', '05'].map((day) => done(`2026-11-${day}`)),
      ...['10', '12', '14'].map((day) => done(`2026-11-${day}`)),
      ...['17', '19'].map((day) => done(`2026-11-${day}`)),
      ...['23', '25', '27'].map((day) => done(`2026-11-${day}`)),
    ];
    expect(challengeTally([threeAWeek()], runs, NOVEMBER, AFTER)).toEqual({
      done: 11,
      missed: 1,
      remaining: 0,
    });
  });

  it('keeps what the running week can still reach, one run a day', () => {
    const window = NOVEMBER;
    const earlier = [
      ...['02', '03', '04'],
      ...['09', '10', '11'],
      ...['16', '17', '18'],
    ].map((day) => done(`2026-11-${day}`));
    // Wednesday the 25th: five days left for three runs.
    expect(
      challengeTally([threeAWeek()], earlier, window, noon('2026-11-25')),
    ).toEqual({ done: 9, missed: 0, remaining: 3 });
    // Saturday the 28th without a run this week: two days for three runs.
    expect(
      challengeTally([threeAWeek()], earlier, window, noon('2026-11-28')),
    ).toEqual({ done: 9, missed: 1, remaining: 2 });
    // Done once on Saturday: Sunday is left for one more.
    expect(
      challengeTally(
        [threeAWeek()],
        [...earlier, done('2026-11-28')],
        window,
        noon('2026-11-28'),
      ),
    ).toEqual({ done: 10, missed: 1, remaining: 1 });
  });

  it('counts a week cut by a start in mid-month by its covered days', () => {
    // From Thursday the 19th: 19–22 is four days (2 due), then 3 and 0.
    const window = { first: '2026-11-19', last: '2026-11-30' };
    const runs = [
      done('2026-11-16'),
      done('2026-11-17'),
      done('2026-11-20'),
      done('2026-11-21'),
      done('2026-11-24'),
    ];
    expect(challengeTally([threeAWeek()], runs, window, AFTER)).toEqual({
      done: 3,
      missed: 2,
      remaining: 0,
    });
  });

  it("names today's open run and today's done run", () => {
    const pending = run('2026-11-25', Status.PENDING);
    const now = noon('2026-11-25');
    expect(
      challengeToday([threeAWeek()], [pending], NOVEMBER, now, ACTIVE),
    ).toEqual({
      state: 'open',
      occurrenceId: pending.id,
    });
    expect(
      challengeToday(
        [threeAWeek()],
        [done('2026-11-25')],
        NOVEMBER,
        now,
        ACTIVE,
      ),
    ).toEqual({ state: 'done' });
    // Outside the challenge's days there is no run of it.
    expect(
      challengeToday(
        [threeAWeek()],
        [pending],
        { first: '2026-12-01', last: '2026-12-31' },
        now,
        ACTIVE,
      ),
    ).toEqual({ state: 'none' });
  });
});
