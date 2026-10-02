import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export class ScheduleDto {
  @IsEnum(HabitScheduleType)
  readonly type!: HabitScheduleType;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  readonly intervalDays?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  readonly weekdays?: Weekday[];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(7)
  readonly weeklyTarget?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(MissedOccurrencePolicy)
  readonly missedOccurrencePolicy?: MissedOccurrencePolicy;
}
