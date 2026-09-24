import { IsEnum } from 'class-validator';
import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

export class UpdateOccurrenceStatusDto {
  @IsEnum(HabitOccurrenceStatus)
  readonly status!: HabitOccurrenceStatus;
}
