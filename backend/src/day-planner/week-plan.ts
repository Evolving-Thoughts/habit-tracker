import { BadRequestException } from '@nestjs/common';
import {
  addDays,
  dayOf,
  endOfDay,
  startOfDay,
  timeOfDayOf,
} from '../common/date/local-day';
import type { ExternalEventEntity } from '../calendar/calendar.entities';
import { NO_STREAK, Streak } from '../habits/streaks';
import { HistoryPlannedItem } from '../history/history.dto';
import { historyRange } from '../history/history-range';
import { placeOpenTodo } from '../todos/todo-agenda';
import { Campaign } from '../todos/todo-ancestry';
import { Orderable, sortInDay } from './day-order';
import type {
  WeekPlanDayDto,
  WeekPlanEntryDto,
  WeekPlanHabitEntryDto,
  WeekPlanTodoEntryDto,
} from './dto/week-plan.dto';

/** An entry with the day it shows on and how that day sorts it. */
export type WeekCandidate = {
  date: string;
  entry: WeekPlanEntryDto;
  order: Orderable;
};

/** The most days one read of the board answers. */
export const MAX_PLAN_DAYS = 31;

/** `days` consecutive days from `from`, the columns of the board. */
export function planDates(from: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1 || days > MAX_PLAN_DAYS)
    throw new BadRequestException(`The plan covers 1 to ${MAX_PLAN_DAYS} days`);
  historyRange(from, 'day');
  const dates = Array.from({ length: days }, (_, index) =>
    addDays(from, index),
  );
  // The last day must also be a supported date.
  historyRange(dates[dates.length - 1], 'day');
  return dates;
}

/**
 * A todo where the agenda shows it: an open one on its day, or on today when
 * it is overdue; a completed one on the day it was completed.
 */
export function todoCandidate(
  todo: {
    id: number;
    title: string;
    completed: boolean;
    completedAt: Date | null;
    scheduledDate: string | null;
    timeOfDay: string | null;
    dayPosition: number | null;
    plannedDurationMinutes: number | null;
  },
  today: string,
  campaign: Campaign | null,
): WeekCandidate {
  const placement = todo.completed ? null : placeOpenTodo(todo, today);
  const date =
    placement?.date ?? (todo.completedAt ? dayOf(todo.completedAt) : null);
  if (!date) throw new Error('Expected a planned or completed todo');
  const scheduledDate = todo.scheduledDate ?? date;
  const entry: WeekPlanTodoEntryDto = {
    type: 'todo',
    todoId: todo.id,
    title: todo.title,
    status: todo.completed ? 'completed' : 'pending',
    scheduledDate,
    isOverdue: placement?.isOverdue ?? false,
    timeOfDay: todo.timeOfDay ?? null,
    plannedDurationMinutes: todo.plannedDurationMinutes,
    campaign,
  };
  return {
    date,
    entry,
    order: {
      scheduledDate,
      timeOfDay: entry.timeOfDay,
      dayPosition: todo.dayPosition,
      id: todo.id,
    },
  };
}

/**
 * A run the habit forecast plans (see history-planning.ts). An open run from
 * an earlier day shows on today, like an overdue todo. A forecast run has no
 * position yet, so it follows everything sorted. A stored run due by today
 * can be measured.
 */
export function plannedHabitCandidate(
  item: HistoryPlannedItem,
  dayPosition: number | null,
  today: string,
  campaign: Campaign | null,
  streak: Streak = NO_STREAK,
  monthChallenge = false,
): WeekCandidate {
  if (item.habitId === null) throw new Error('Expected a planned habit run');
  const date = item.date < today ? today : item.date;
  const entry: WeekPlanHabitEntryDto = {
    type: 'habit',
    habitId: item.habitId,
    occurrenceId: item.id,
    status: 'pending',
    moveUntil: item.moveUntil,
    timerEligible: item.id !== null && date <= today,
    streak,
    monthChallenge,
    isOverdue: item.isOverdue,
    title: item.title,
    timeOfDay: item.timeOfDay,
    plannedDurationMinutes: item.plannedDurationMinutes,
    campaign,
  };
  return {
    date,
    entry,
    order: {
      scheduledDate: item.isOverdue ? item.scheduledDate : date,
      timeOfDay: item.timeOfDay,
      // A forecast run's place waits until its day stores it.
      dayPosition,
      id: item.id ?? Number.MAX_SAFE_INTEGER,
    },
  };
}

/** A completed run on the day it was done, a skipped one on its due day. */
export function resolvedHabitCandidate(
  occurrence: {
    id: number;
    habitId: number;
    status: 'completed' | 'skipped';
    scheduledDate: string;
    resolvedDate: string | null;
    dayPosition: number | null;
  },
  habit: { title: string; timeOfDay: string | null },
  plannedDurationMinutes: number | null,
  campaign: Campaign | null,
  streak: Streak = NO_STREAK,
  monthChallenge = false,
): WeekCandidate {
  const date =
    occurrence.status === 'completed'
      ? (occurrence.resolvedDate ?? occurrence.scheduledDate)
      : occurrence.scheduledDate;
  const entry: WeekPlanHabitEntryDto = {
    type: 'habit',
    habitId: occurrence.habitId,
    occurrenceId: occurrence.id,
    status: occurrence.status,
    moveUntil: null,
    timerEligible: false,
    streak,
    monthChallenge,
    isOverdue: false,
    title: habit.title,
    timeOfDay: habit.timeOfDay ?? null,
    plannedDurationMinutes,
    campaign,
  };
  return {
    date,
    entry,
    order: {
      scheduledDate: date,
      timeOfDay: entry.timeOfDay,
      dayPosition: occurrence.dayPosition,
      id: occurrence.id,
    },
  };
}

/**
 * A Google event on each of `dates` it occupies. On a day it began before,
 * it stands at midnight. Its place in the order is the one stored for it.
 */
export function eventCandidates(
  events: readonly ExternalEventEntity[],
  dates: readonly string[],
): WeekCandidate[] {
  return events.flatMap((event) =>
    dates
      .filter(
        (date) => event.start < endOfDay(date) && event.end > startOfDay(date),
      )
      .map((date): WeekCandidate => {
        const timeOfDay =
          event.start < startOfDay(date) ? '00:00' : timeOfDayOf(event.start);
        return {
          date,
          entry: {
            type: 'event',
            eventId: event.id,
            status: event.doneAt ? 'completed' : 'pending',
            start: event.start.toISOString(),
            end: event.end.toISOString(),
            title: event.title,
            timeOfDay,
            plannedDurationMinutes: null,
            campaign: null,
            isOverdue: false,
          },
          order: {
            scheduledDate: date,
            timeOfDay,
            dayPosition: event.dayPosition,
            id: event.id,
          },
        };
      }),
  );
}

const isOpen = (entry: WeekPlanEntryDto): boolean => entry.status === 'pending';

/** What one read of the board shows: its days and what was left behind. */
export type ArrangedPlan = {
  days: WeekPlanDayDto[];
  overdue: WeekPlanEntryDto[];
};

/**
 * The board: every day lists its open entries in the order of the day
 * (day-order.ts), then what is already done in that same order. What is
 * open and overdue (the agenda carries it to today, as Heute's Nachholen
 * does) stands apart, earliest day first, whatever days are shown.
 * Other candidates outside the days are left out.
 */
export function arrangePlan(
  dates: string[],
  candidates: WeekCandidate[],
): ArrangedPlan {
  const sorted = (list: WeekCandidate[]): WeekPlanEntryDto[] =>
    sortInDay(list, ({ order }) => order).map(({ entry }) => entry);
  const overdue = candidates.filter(
    ({ entry }) => isOpen(entry) && entry.isOverdue,
  );
  const placed = candidates.filter((candidate) => !overdue.includes(candidate));
  return {
    days: dates.map((date) => {
      const own = placed.filter((candidate) => candidate.date === date);
      return {
        date,
        entries: [
          ...sorted(own.filter(({ entry }) => isOpen(entry))),
          ...sorted(own.filter(({ entry }) => !isOpen(entry))),
        ],
      };
    }),
    overdue: sorted(overdue),
  };
}
