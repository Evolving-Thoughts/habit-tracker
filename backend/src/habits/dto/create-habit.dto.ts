import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export class CreateHabitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsEnum(HabitScheduleType)
  readonly scheduleType!: HabitScheduleType;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use the format YYYY-MM-DD',
  })
  readonly startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly intervalDays?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  readonly weekdays?: Weekday[] | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  readonly weeklyTarget?: number | null;

  @IsOptional()
  @IsEnum(MissedOccurrencePolicy)
  readonly missedOccurrencePolicy?: MissedOccurrencePolicy;
}
