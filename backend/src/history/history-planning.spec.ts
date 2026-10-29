import {
  forecastSlots,
  plannedHabits,
  weeklyTargets,
} from './history-planning';
import { addDays as addHistoryDays } from '../common/date/local-day';
import { historyRange } from './history-range';
import {
  buildVersion,
  normalizeSchedule,
} from '../habits/scheduling/schedule-rules';
import { HabitScheduleType as Type } from '../habits/enums/habit-schedule-type.enum';
import { Weekday } from '../habits/enums/weekday.enum';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { MissedOccurrencePolicy as Policy } from '../habits/enums/missed-occurrence-policy.enum';
const today = '2026-10-07';
const now = new Date('2026-10-07T12:00:00Z');
const dates = historyRange(today, 'week');
const habit = Object.assign(new HabitEntity(), {
  id: 1,
  title: 'Gitarre',
  isActive: true,
  deletedAt: null,
  plannedDurationMinutes: 20,
});
function version(type = Type.INTERVAL) {
  return Object.assign(
    buildVersion(
      1,
      normalizeSchedule(
        type === Type.INTERVAL
          ? { type, intervalDays: 3 }
          : type === Type.FIXED_WEEKDAYS
            ? { type, weekdays: [Weekday.MONDAY, Weekday.FRIDAY] }
            : { type, weeklyTarget: 3 },
      ),
      new Date('2026-10-05T00:00:00Z'),
    ),
    { id: 1 },
  );
}
describe('Read-only weekly forecasts', () => {
  it('places interval slots and an unexpired carry-over on today, not on past days', () => {
    const slots = forecastSlots([version()], dates, today, now);
    expect(slots.map((s) => [s.date, s.scheduledDate])).toEqual([
      ['2026-10-07', '2026-10-05'],
      ['2026-10-08', '2026-10-08'],
      ['2026-10-11', '2026-10-11'],
    ]);
  });
  it('does not replay historical schedules to reach a distant future week', () => {
    const v = version();
    v.firstDueDate = '1000-01-01';
    v.effectiveAt = new Date('1000-01-01T00:00:00Z');
    expect(
      forecastSlots([v], historyRange('9999-12-20', 'week'), today, now).length,
    ).toBeGreaterThan(0);
  });
  it('excludes expired skip slots and uses fixed weekdays', () => {
    const v = version(Type.FIXED_WEEKDAYS);
    v.missedOccurrencePolicy = Policy.SKIP;
    expect(forecastSlots([v], dates, today, now).map((s) => s.date)).toEqual([
      '2026-10-09',
    ]);
    v.missedOccurrencePolicy = Policy.CARRY_OVER;
    expect(
      forecastSlots([v], dates, today, now).map((s) => s.scheduledDate),
    ).toEqual(['2026-10-05', '2026-10-09']);
  });
  it('uses exclusive schedule ends, effective instants and ignores cancelled versions', () => {
    const old = version();
    old.endsAt = new Date('2026-10-08T22:00:00Z');
    const next = version(Type.FIXED_WEEKDAYS);
    next.id = 2;
    next.effectiveAt = old.endsAt;
    const cancelled = version();
    cancelled.cancelledAt = now;
    const slots = forecastSlots([old, next, cancelled], dates, today, now);
    expect(slots.map((s) => [s.version.id, s.scheduledDate])).toEqual([
      [1, '2026-10-05'],
      [1, '2026-10-08'],
      [2, '2026-10-09'],
    ]);
    old.endsAt = new Date('2026-10-07T09:00:00Z');
    expect(forecastSlots([old], dates, today, now)).toEqual([]);
  });
  it('suppresses resolved/cancelled slots, completion-today duplicates, paused/deleted habits; never mutates input', () => {
    const v = version();
    const slots = forecastSlots([v], dates, today, now);
    const stored = Object.assign(new HabitOccurrenceEntity(), {
      id: 2,
      habitId: 1,
      scheduleVersionId: 1,
      scheduledDate: '2026-10-08',
      status: Status.SKIPPED,
      resolvedDate: '2026-10-07',
    });
    const before = JSON.stringify([habit, slots, stored]);
    expect(
      plannedHabits([habit], slots, [stored], today).map(
        (s) => s.scheduledDate,
      ),
    ).toEqual(['2026-10-05', '2026-10-11']);
    stored.status = Status.CANCELLED;
    expect(plannedHabits([habit], slots, [stored], today)).toHaveLength(2);
    stored.status = Status.SKIPPED;
    expect(JSON.stringify([habit, slots, stored])).toBe(before);
    stored.status = Status.COMPLETED;
    expect(
      plannedHabits([habit], slots, [stored], today).map((s) => s.date),
    ).toEqual(['2026-10-11']);
    expect(
      plannedHabits([{ ...habit, isActive: false }], slots, [], today),
    ).toEqual([]);
    expect(
      plannedHabits([{ ...habit, deletedAt: now }], slots, [], today),
    ).toEqual([]);
  });
  it('counts weekly completions under all versions, not skips, and never assigns target days', () => {
    const v = version(Type.WEEKLY_TARGET);
    const stored = Object.assign(new HabitOccurrenceEntity(), {
      habitId: 1,
      scheduleVersionId: 99,
      status: Status.COMPLETED,
      resolvedDate: '2026-10-06',
    });
    expect(forecastSlots([v], dates, today, now)).toEqual([]);
    const result = weeklyTargets(
      [habit],
      [v],
      [
        stored,
        { ...stored, status: Status.SKIPPED },
        { ...stored, resolvedDate: '2026-10-04' },
      ],
      dates,
      today,
      now,
    );
    expect(result[0]).toMatchObject({
      completed: 1,
      remaining: 2,
      target: 3,
      fromDate: today,
      untilDate: '2026-10-11',
    });
    expect(
      weeklyTargets(
        [habit],
        [v],
        Array.from({ length: 4 }, () => stored),
        dates,
        today,
        now,
      )[0].remaining,
    ).toBe(0);
    expect(
      weeklyTargets(
        [habit],
        [v],
        [],
        historyRange('2026-09-01', 'week'),
        today,
        now,
      ),
    ).toEqual([]);
  });
  it('shows weekly target changes with their valid date ranges', () => {
    const v = version(Type.WEEKLY_TARGET);
    v.endsAt = new Date('2026-10-08T22:00:00Z');
    const next = {
      ...v,
      id: 2,
      effectiveAt: v.endsAt,
      endsAt: null,
      weeklyTarget: 5,
    };
    expect(
      weeklyTargets([habit], [v, next], [], dates, today, now).map((t) => [
        t.fromDate,
        t.untilDate,
        t.target,
      ]),
    ).toEqual([
      [today, '2026-10-08', 3],
      ['2026-10-09', '2026-10-11', 5],
    ]);
  });
  it('preserves a pending slot identity and its occurrence-specific planned duration', () => {
    const slots = forecastSlots([version()], dates, today, now);
    const stored = Object.assign(new HabitOccurrenceEntity(), {
      id: 7,
      habitId: 1,
      scheduleVersionId: 1,
      scheduledDate: '2026-10-05',
      status: Status.PENDING,
      resolvedDate: null,
      plannedDurationMinutes: 12,
    });
    expect(plannedHabits([habit], slots, [stored], today)[0]).toMatchObject({
      id: 7,
      scheduledDate: '2026-10-05',
      date: today,
      plannedDurationMinutes: 12,
      isOverdue: true,
    });
  });
  it('keeps interval calendar spacing through both Berlin DST transitions', () => {
    for (const [anchor, last] of [
      ['2026-03-23', '2026-03-29'],
      ['2026-10-19', '2026-10-25'],
    ]) {
      const v = version();
      v.firstDueDate = anchor;
      v.effectiveAt = new Date(`${anchor}T00:00:00Z`);
      v.intervalDays = 2;
      expect(
        forecastSlots(
          [v],
          historyRange(anchor, 'week'),
          '2026-01-01',
          new Date('2026-01-01T00:00:00Z'),
        ).map((slot) => slot.date),
      ).toEqual([
        anchor,
        addHistoryDays(anchor, 2),
        addHistoryDays(anchor, 4),
        last,
      ]);
    }
  });
  it('does not expose zero-duration, cancelled or paused weekly target versions', () => {
    const v = version(Type.WEEKLY_TARGET);
    v.endsAt = v.effectiveAt;
    expect(
      weeklyTargets(
        [habit],
        [v],
        [],
        dates,
        '2026-10-01',
        new Date('2026-10-01T00:00:00Z'),
      ),
    ).toEqual([]);
    v.endsAt = null;
    v.cancelledAt = now;
    expect(weeklyTargets([habit], [v], [], dates, today, now)).toEqual([]);
    v.cancelledAt = null;
    expect(
      weeklyTargets(
        [{ ...habit, isActive: false }],
        [v],
        [],
        dates,
        today,
        now,
      ),
    ).toEqual([]);
  });
});
