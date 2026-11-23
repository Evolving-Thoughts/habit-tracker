import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../../habits/enums/habit-schedule-type.enum';
import type { QuestHoursToday } from '../../quest-hours/quest-hours.dto';
import type { CampaignColor } from '../../todos/campaign-style';
import type { Campaign } from '../../todos/todo-ancestry';
import type { Streak } from '../../habits/streaks';
import type { MonthChallengeResponse } from '../../month-challenges/month-challenge.dto';

export type DayPlannerTodoStatus = 'pending' | 'completed';

/** The goal an item serves: a todo's parent, or the goal counting a habit. */
export type DayPlannerGoalDto = {
  title: string;
  /** Habit goals only: completed runs, target and the period's last day. */
  completed: number | null;
  target: number | null;
  periodEnd: string | null;
};

/** What every planned item carries beside its own fields. */
type DayPlannerItemContext = {
  dayPosition?: number | null;
  /** The reason to show: the item's own, else the inherited one. */
  why: string | null;
  goal: DayPlannerGoalDto | null;
  /** The campaign the item works towards; null for a loose item. */
  campaign: Campaign | null;
  /** Minutes logged on this item today. */
  workedMinutes: number;
};

export type DayPlannerTodoItemDto = {
  type: 'todo';
  todoId: number;
  title: string;
  categoryName: string | null;
  /** The category's chosen colour; null while its name picks one. */
  categoryColor: CampaignColor | null;
  status: DayPlannerTodoStatus;
  scheduledDate: string;
  /** HH:mm of an appointment; null for a todo that only has its day. */
  timeOfDay: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isOverdue: boolean;
  timerEligible: boolean;
} & DayPlannerItemContext;

export type DayPlannerHabitItemDto = {
  type: 'habit';
  plannedDurationMinutes: number | null;
  timeOfDay: string | null;
  occurrenceId: number;
  habitId: number;
  title: string;
  categoryName: string | null;
  /** The category's chosen colour; null while its name picks one. */
  categoryColor: CampaignColor | null;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  /** Last day this pending occurrence can be moved to; null once resolved. */
  moveUntil: string | null;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
  timerEligible: boolean;
  /** The daily's series (see habits/streaks.ts). */
  streak: Streak;
  /** The Daily carries the running Monats-Challenge (the row's marker). */
  monthChallenge: boolean;
} & DayPlannerItemContext;

export type DayPlannerItemDto = DayPlannerTodoItemDto | DayPlannerHabitItemDto;

export type DayPlannerExternalEventDto = {
  id: number;
  title: string;
  start: string;
  end: string;
};

export class DayPlannerResponseDto {
  readonly date: string;
  /**
   * Appointments and timed habits by clock, then everything else in the
   * order of the day (see day-order.ts).
   */
  readonly items: DayPlannerItemDto[];
  /** Read-only events of the main Google calendar. */
  readonly externalEvents: DayPlannerExternalEventDto[];
  /** All time logged today; overlapping logs count once. */
  readonly workedMinutes: number;
  /** Quest minutes today and this week, against the overall weekly goal. */
  readonly questHours: QuestHoursToday;
  /** This month's running Monats-Challenge with its progress, for its card. */
  readonly monthChallenge: MonthChallengeResponse | null;

  constructor(properties: {
    date: string;
    items: DayPlannerItemDto[];
    externalEvents?: DayPlannerExternalEventDto[];
    workedMinutes?: number;
    questHours?: QuestHoursToday;
    monthChallenge?: MonthChallengeResponse | null;
  }) {
    this.date = properties.date;
    this.items = properties.items;
    this.externalEvents = properties.externalEvents ?? [];
    this.workedMinutes = properties.workedMinutes ?? 0;
    this.questHours = properties.questHours ?? {
      todayMinutes: 0,
      weekMinutes: 0,
      weeklyTargetMinutes: null,
    };
    this.monthChallenge = properties.monthChallenge ?? null;
  }
}
