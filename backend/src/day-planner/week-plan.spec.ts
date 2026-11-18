import { BadRequestException } from '@nestjs/common';
import { HistoryPlannedItem } from '../history/history.dto';
import {
  arrangeWeek,
  plannedHabitCandidate,
  resolvedHabitCandidate,
  todoCandidate,
  weekDates,
} from './week-plan';

const TODAY = '2026-11-17';
const WEEK = weekDates('2026-11-16');

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
      why: null,
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

const titlesOn = (date: string, days: ReturnType<typeof arrangeWeek>) =>
  days.find((day) => day.date === date)!.entries.map(({ title }) => title);

describe('weekDates', () => {
  it('lists Monday to Sunday', () => {
    expect(WEEK).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it.each(['2026-11-17', '2026-11-22', '2026-02-30', '16.11.2026'])(
    'refuses %s as the start of a week',
    (start) => {
      expect(() => weekDates(start)).toThrow(BadRequestException);
    },
  );
});

describe('todoCandidate', () => {
  it('shows an open todo on its day', () => {
    const { date, entry } = todo(1, { scheduledDate: '2026-11-19' });
    expect(date).toBe('2026-11-19');
    expect(entry).toMatchObject({ status: 'pending', isOverdue: false });
  });

  it('carries an overdue todo to today and keeps the day it was planned for', () => {
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
  it('keeps a forecast run without a stored occurrence or a position', () => {
    const { date, entry, order } = planned({}, 4);
    expect(date).toBe('2026-11-18');
    expect(entry).toMatchObject({
      type: 'habit',
      occurrenceId: null,
      status: 'pending',
      campaign: { id: 9, title: 'Marathon', color: null, icon: null },
      plannedDurationMinutes: 20,
    });
    expect(order.dayPosition).toBeNull();
  });

  it('shows an open run moved to an earlier day on today', () => {
    const { date } = planned({
      id: 5,
      date: '2026-11-16',
      scheduledDate: '2026-11-16',
      isOverdue: true,
    });
    expect(date).toBe(TODAY);
  });
});

describe('arrangeWeek', () => {
  it('orders a day like Heute: earlier days, then the clock, then positions', () => {
    const days = arrangeWeek(WEEK, [
      todo(1, { dayPosition: 1 }),
      todo(2, { dayPosition: 0 }),
      todo(3, { timeOfDay: '09:00' }),
      todo(4, { scheduledDate: '2026-11-12' }),
      todo(5),
    ]);
    expect(titlesOn(TODAY, days)).toEqual([
      'Quest 4',
      'Quest 3',
      'Quest 2',
      'Quest 1',
      'Quest 5',
    ]);
  });

  it('sorts stored runs into the order and lets forecast runs follow it', () => {
    const days = arrangeWeek(WEEK, [
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
    const days = arrangeWeek(WEEK, [
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
    const days = arrangeWeek(WEEK, [todo(1, { scheduledDate: '2026-11-30' })]);
    expect(days.map(({ date }) => date)).toEqual(WEEK);
    expect(days.every(({ entries }) => entries.length === 0)).toBe(true);
  });
});
