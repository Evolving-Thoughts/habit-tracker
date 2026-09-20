import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export class UpdateHabitDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(HabitScheduleType)
  readonly scheduleType?: HabitScheduleType;

  @ValidateIf((_object, value: unknown) => value !== undefined)
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

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(MissedOccurrencePolicy)
  readonly missedOccurrencePolicy?: MissedOccurrencePolicy;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly isActive?: boolean;
}
