import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

export type HabitOccurrenceResponseDtoProperties = {
  id: number;
  habitId: number;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  resolvedDate: string | null;
};

export class HabitOccurrenceResponseDto {
  readonly id: number;
  readonly habitId: number;
  readonly scheduledDate: string;
  readonly status: HabitOccurrenceStatus;
  readonly resolvedDate: string | null;

  constructor(properties: HabitOccurrenceResponseDtoProperties) {
    this.id = properties.id;
    this.habitId = properties.habitId;
    this.scheduledDate = properties.scheduledDate;
    this.status = properties.status;
    this.resolvedDate = properties.resolvedDate;
  }
}
