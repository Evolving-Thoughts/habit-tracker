import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export type HabitResponseDtoProperties = {
  id: number;
  title: string;
  scheduleType: HabitScheduleType;
  startDate: string;
  intervalDays: number | null;
  weekdays: Weekday[] | null;
  weeklyTarget: number | null;
  missedOccurrencePolicy: MissedOccurrencePolicy;
  isActive: boolean;
};

export class HabitResponseDto {
  readonly id: number;
  readonly title: string;
  readonly scheduleType: HabitScheduleType;
  readonly startDate: string;
  readonly intervalDays: number | null;
  readonly weekdays: Weekday[] | null;
  readonly weeklyTarget: number | null;
  readonly missedOccurrencePolicy: MissedOccurrencePolicy;
  readonly isActive: boolean;

  constructor(properties: HabitResponseDtoProperties) {
    this.id = properties.id;
    this.title = properties.title;
    this.scheduleType = properties.scheduleType;
    this.startDate = properties.startDate;
    this.intervalDays = properties.intervalDays;
    this.weekdays = properties.weekdays;
    this.weeklyTarget = properties.weeklyTarget;
    this.missedOccurrencePolicy = properties.missedOccurrencePolicy;
    this.isActive = properties.isActive;
  }
}
