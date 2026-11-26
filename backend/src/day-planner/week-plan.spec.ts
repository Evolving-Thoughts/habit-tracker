import { BadRequestException } from '@nestjs/common';
import type { ExternalEventEntity } from '../calendar/calendar.entities';
import { HistoryPlannedItem } from '../history/history.dto';
import {
  arrangePlan,
  eventCandidates,
  MAX_PLAN_DAYS,
  planDates,
  plannedHabitCandidate,
  resolvedHabitCandidate,
  todoCandidate,
} from './week-plan';

const TODAY = '2026-11-17';
const WEEK = planDates('2026-11-16', 7);

const todo = (
  id: number,
  overrides: Partial<Parameters<typeof todoCandidate>[0]> = {},
) =>
  todoCandidate(
    {
      id,
      title: `Quest ${id}`,
      completed: false,
      completedAt: null,
      scheduledDate: TODAY,
      timeOfDay: null,
      dayPosition: null,
      plannedDurationMinutes: null,
      ...overrides,
    },
    TODAY,
    null,
  );

const planned = (
  overrides: Partial<HistoryPlannedItem> = {},
  dayPosition: number | null = null,
) =>
  plannedHabitCandidate(
    {
      key: 'habit:1:2026-11-18',
      type: 'habit',
      id: null,
      habitId: 3,
      title: 'Laufen',
      categoryName: null,
      categoryColor: null,
      why: null,
      campaign: null,
      date: '2026-11-18',
      scheduledDate: '2026-11-18',
      isOverdue: false,
      plannedDurationMinutes: 20,
      timeOfDay: null,
      moveUntil: null,
      ...overrides,
    },
    dayPosition,
    TODAY,
    { id: 9, title: 'Marathon', color: null, icon: null },
  );

const arrangeWeek = (candidates: Parameters<typeof arrangePlan>[1]) =>
  arrangePlan(WEEK, candidates).days;
const titlesOn = (date: string, days: ReturnType<typeof arrangeWeek>) =>
  days.find((day) => day.date === date)!.entries.map(({ title }) => title);

describe('planDates', () => {
  it('lists the days from the first one, on any weekday and across a month', () => {
    expect(planDates('2026-11-28', 4)).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
    ]);
    expect(planDates('2026-11-20', 1)).toEqual(['2026-11-20']);
    expect(planDates('2026-11-20', MAX_PLAN_DAYS)).toHaveLength(MAX_PLAN_DAYS);
  });

  it.each([
    ['2026-11-20', 0],
    ['2026-11-20', MAX_PLAN_DAYS + 1],
    ['2026-11-20', 1.5],
    ['2026-02-30', 3],
    ['20.11.2026', 3],
    ['9999-12-30', 3],
  ])('refuses %s with %p days', (from, days) => {
    expect(() => planDates(from, days)).toThrow(BadRequestException);
  });
});

describe('todoCandidate', () => {
  it('shows an open todo on its day', () => {
    const { date, entry } = todo(1, { scheduledDate: '2026-11-19' });
    expect(date).toBe('2026-11-19');
    expect(entry).toMatchObject({ status: 'pending', isOverdue: false });
  });

  it('marks an overdue todo and keeps the day it was planned for', () => {
    const { date, entry } = todo(1, { scheduledDate: '2026-11-10' });
    expect(date).toBe(TODAY);
    expect(entry).toMatchObject({
      scheduledDate: '2026-11-10',
      isOverdue: true,
    });
  });

  it('shows a completed todo on the day it was completed', () => {
    const { date, entry } = todo(1, {
      completed: true,
      completedAt: new Date('2026-11-16T20:00:00Z'),
      scheduledDate: '2026-11-18',
    });
    expect(date).toBe('2026-11-16');
    expect(entry).toMatchObject({ status: 'completed', isOverdue: false });
  });
});

describe('plannedHabitCandidate', () => {
  it('keeps a forecast run without a stored occurrence, at the place it was sorted into', () => {
    expect(planned({}, null).order.dayPosition).toBeNull();
    const { date, entry, order } = planned({}, 4);
    expect(date).toBe('2026-11-18');
    expect(entry).toMatchObject({
      type: 'habit',
      occurrenceId: null,
      status: 'pending',
      campaign: { id: 9, title: 'Marathon', color: null, icon: null },
      plannedDurationMinutes: 20,
    });
    // Its place waits until its day stores the run (habit_forecast_places).
    expect(order.dayPosition).toBe(4);
  });

  it('marks an open run from an earlier day as overdue on today', () => {
    const { date } = planned({
      id: 5,
      date: '2026-11-16',
      scheduledDate: '2026-11-16',
      isOverdue: true,
    });
    expect(date).toBe(TODAY);
  });
});

describe('arrangePlan', () => {
  it('orders a day like Heute: the clock, then positions, then the rest', () => {
    const days = arrangeWeek([
      todo(1, { dayPosition: 1 }),
      todo(2, { dayPosition: 0 }),
      todo(3, { timeOfDay: '09:00' }),
      todo(5),
    ]);
    expect(titlesOn(TODAY, days)).toEqual([
      'Quest 3',
      'Quest 2',
      'Quest 1',
      'Quest 5',
    ]);
  });

  it('keeps what is overdue apart from today, earliest day first, whatever days are shown', () => {
    const { days, overdue } = arrangePlan(
      ['2026-11-20', '2026-11-21'],
      [
        todo(1, { scheduledDate: '2026-11-14', dayPosition: 0 }),
        todo(2, { scheduledDate: '2026-11-12' }),
        planned({
          id: 6,
          title: 'Liegengebliebener Lauf',
          date: '2026-11-15',
          scheduledDate: '2026-11-15',
          isOverdue: true,
        }),
        todo(3),
      ],
    );
    expect(overdue.map(({ title }) => title)).toEqual([
      'Quest 2',
      'Quest 1',
      'Liegengebliebener Lauf',
    ]);
    expect(days.every(({ entries }) => entries.length === 0)).toBe(true);
    expect(
      titlesOn(TODAY, arrangeWeek([todo(2, { scheduledDate: '2026-11-12' })])),
    ).toEqual([]);
  });

  it('sorts stored runs into the order and lets forecast runs follow it', () => {
    const days = arrangeWeek([
      todo(1, { scheduledDate: '2026-11-18', dayPosition: 1 }),
      todo(2, { scheduledDate: '2026-11-18' }),
      planned({ title: 'Vorhergesagt' }),
      planned({ id: 8, title: 'Gespeichert' }, 0),
    ]);
    expect(titlesOn('2026-11-18', days)).toEqual([
      'Gespeichert',
      'Quest 1',
      'Quest 2',
      'Vorhergesagt',
    ]);
  });

  it('puts what is done after what is open', () => {
    const days = arrangeWeek([
      todo(1, {
        completed: true,
        completedAt: new Date('2026-11-17T08:00:00Z'),
        dayPosition: 0,
      }),
      resolvedHabitCandidate(
        {
          id: 7,
          habitId: 3,
          status: 'skipped',
          scheduledDate: TODAY,
          resolvedDate: TODAY,
          dayPosition: null,
        },
        { title: 'Lesen', timeOfDay: null },
        null,
        null,
      ),
      todo(2, { dayPosition: 3 }),
    ]);
    expect(titlesOn(TODAY, days)).toEqual(['Quest 2', 'Quest 1', 'Lesen']);
  });

  it('gives every day of the week a column and drops what lies outside', () => {
    const days = arrangeWeek([todo(1, { scheduledDate: '2026-11-30' })]);
    expect(days.map(({ date }) => date)).toEqual(WEEK);
    expect(days.every(({ entries }) => entries.length === 0)).toBe(true);
  });
});

describe('eventCandidates', () => {
  const event = (
    start: string,
    end: string,
    dayPosition: number | null = null,
  ): ExternalEventEntity =>
    ({
      id: 9,
      userId: 'u',
      calendarId: 'primary',
      eventId: 'g9',
      title: 'Zahnarzt',
      start: new Date(start),
      end: new Date(end),
      dayPosition,
    }) as ExternalEventEntity;

  it('puts an event on its day at its Berlin start, with its place', () => {
    const [candidate, ...rest] = eventCandidates(
      [event('2026-11-17T13:00:00Z', '2026-11-17T14:00:00Z', 2)],
      WEEK,
    );
    expect(rest).toHaveLength(0);
    expect(candidate.date).toBe(TODAY);
    expect(candidate.entry).toMatchObject({
      type: 'event',
      eventId: 9,
      status: 'pending',
      timeOfDay: '14:00',
      title: 'Zahnarzt',
    });
    expect(candidate.order.dayPosition).toBe(2);
  });

  it('stands at midnight on a day it began before', () => {
    const days = eventCandidates(
      [event('2026-11-17T21:00:00Z', '2026-11-18T09:00:00Z')],
      WEEK,
    );
    expect(days.map(({ date, entry }) => [date, entry.timeOfDay])).toEqual([
      ['2026-11-17', '22:00'],
      ['2026-11-18', '00:00'],
    ]);
  });

  it('sorts among the day like an appointment', () => {
    const { days } = arrangePlan(WEEK, [
      todo(1, { dayPosition: 0 }),
      todo(2, { dayPosition: 2 }),
      ...eventCandidates(
        [event('2026-11-17T13:00:00Z', '2026-11-17T14:00:00Z', 1)],
        WEEK,
      ),
    ]);
    expect(
      days
        .find(({ date }) => date === TODAY)!
        .entries.map(({ title }) => title),
    ).toEqual(['Quest 1', 'Zahnarzt', 'Quest 2']);
  });
});
