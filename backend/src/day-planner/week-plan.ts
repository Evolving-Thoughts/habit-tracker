import { BadRequestException } from '@nestjs/common';
import { dayOf, weekRange } from '../common/date/local-day';
import { HistoryPlannedItem } from '../history/history.dto';
import { historyRange } from '../history/history-range';
import { placeOpenTodo } from '../todos/todo-agenda';
import { Campaign } from '../todos/todo-ancestry';
import { compareInDay, Orderable } from './day-order';
import {
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

/** The seven days of the week starting on `start`, which must be a Monday. */
export function weekDates(start: string): string[] {
  const dates = historyRange(start, 'week');
  if (weekRange(start).startDate !== start)
    throw new BadRequestException('The week must start on a Monday');
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
 * position yet, so it follows everything sorted.
 */
export function plannedHabitCandidate(
  item: HistoryPlannedItem,
  dayPosition: number | null,
  today: string,
  campaign: Campaign | null,
): WeekCandidate {
  if (item.habitId === null) throw new Error('Expected a planned habit run');
  const date = item.date < today ? today : item.date;
  const entry: WeekPlanHabitEntryDto = {
    type: 'habit',
    habitId: item.habitId,
    occurrenceId: item.id,
    status: 'pending',
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
      dayPosition: item.id === null ? null : dayPosition,
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

const isOpen = (entry: WeekPlanEntryDto): boolean => entry.status === 'pending';

/**
 * The board of a week: every day lists its open entries in the order of the
 * day (day-order.ts), then what is already done in that same order.
 * Candidates outside the week are left out.
 */
export function arrangeWeek(
  dates: string[],
  candidates: WeekCandidate[],
): WeekPlanDayDto[] {
  return dates.map((date) => {
    const own = candidates.filter((candidate) => candidate.date === date);
    const sorted = (open: boolean): WeekPlanEntryDto[] =>
      own
        .filter(({ entry }) => isOpen(entry) === open)
        .sort((first, second) => compareInDay(first.order, second.order))
        .map(({ entry }) => entry);
    return { date, entries: [...sorted(true), ...sorted(false)] };
  });
}
