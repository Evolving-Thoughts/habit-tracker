import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ScheduleDto } from './schedule.dto';

export class CreateHabitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  readonly plannedDurationMinutes?: number | null;
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly startDate?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ScheduleDto)
  readonly schedule!: ScheduleDto;
}
