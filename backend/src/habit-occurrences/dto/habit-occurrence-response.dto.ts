import { HabitOccurrenceCancellationReason } from '../entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

export type HabitOccurrenceResponseDto = {
  id: number;
  habitId: number;
  scheduleVersionId: number;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  resolvedDate: string | null;
  cancellationReason: HabitOccurrenceCancellationReason | null;
};
