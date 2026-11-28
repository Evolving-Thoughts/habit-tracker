import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { OptionalNotNull } from '../../common/validation/field-rules';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export class ScheduleDto {
  @IsEnum(HabitScheduleType)
  readonly type!: HabitScheduleType;

  @OptionalNotNull()
  @IsInt()
  @Min(1)
  readonly intervalDays?: number;

  @OptionalNotNull()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  readonly weekdays?: Weekday[];

  @OptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(7)
  readonly weeklyTarget?: number;

  @OptionalNotNull()
  @IsEnum(MissedOccurrencePolicy)
  readonly missedOccurrencePolicy?: MissedOccurrencePolicy;
}
