import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../../habits/enums/habit-schedule-type.enum';

export type DayPlannerTodoStatus = 'pending' | 'completed';

export type DayPlannerTodoItemDto = {
  type: 'todo';
  todoId: number;
  title: string;
  categoryName: string | null;
  status: DayPlannerTodoStatus;
  scheduledDate: string;
  scheduledAt: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  isOverdue: boolean;
  timerEligible: boolean;
};

export type DayPlannerHabitItemDto = {
  type: 'habit';
  plannedDurationMinutes: number | null;
  timeOfDay: string | null;
  occurrenceId: number;
  habitId: number;
  title: string;
  categoryName: string | null;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  /** Last day this pending occurrence can be moved to; null once resolved. */
  moveUntil: string | null;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
  timerEligible: boolean;
};

export type DayPlannerItemDto = DayPlannerTodoItemDto | DayPlannerHabitItemDto;

export type DayPlannerExternalEventDto = {
  id: number;
  title: string;
  start: string;
  end: string;
};

export class DayPlannerResponseDto {
  readonly date: string;
  readonly items: DayPlannerItemDto[];
  /** Read-only events of the main Google calendar. */
  readonly externalEvents: DayPlannerExternalEventDto[];

  constructor(properties: {
    date: string;
    items: DayPlannerItemDto[];
    externalEvents?: DayPlannerExternalEventDto[];
  }) {
    this.date = properties.date;
    this.items = properties.items;
    this.externalEvents = properties.externalEvents ?? [];
  }
}
