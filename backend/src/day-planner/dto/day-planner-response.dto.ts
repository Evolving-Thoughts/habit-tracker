import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../../habits/enums/habit-schedule-type.enum';

export type DayPlannerTodoStatus = 'pending' | 'completed';

export type DayPlannerTodoItemDto = {
  type: 'todo';
  todoId: number;
  title: string;
  status: DayPlannerTodoStatus;
  scheduledDate: string;
  scheduledAt: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  isOverdue: boolean;
};

export type DayPlannerHabitItemDto = {
  type: 'habit';
  plannedDurationMinutes: number | null;
  occurrenceId: number;
  habitId: number;
  title: string;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
};

export type DayPlannerItemDto = DayPlannerTodoItemDto | DayPlannerHabitItemDto;

export class DayPlannerResponseDto {
  readonly date: string;
  readonly items: DayPlannerItemDto[];

  constructor(properties: { date: string; items: DayPlannerItemDto[] }) {
    this.date = properties.date;
    this.items = properties.items;
  }
}
