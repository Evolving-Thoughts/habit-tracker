import { IsIn } from 'class-validator';
import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

export class UpdateOccurrenceStatusDto {
  @IsIn([
    HabitOccurrenceStatus.PENDING,
    HabitOccurrenceStatus.COMPLETED,
    HabitOccurrenceStatus.SKIPPED,
  ])
  readonly status!: HabitOccurrenceStatus;
}
