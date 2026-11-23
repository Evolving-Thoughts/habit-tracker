import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
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
  IsIn,
} from 'class-validator';
import { ScheduleDto } from './schedule.dto';

export class CreateHabitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  readonly plannedDurationMinutes?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  readonly timeOfDay?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly categoryId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly campaignId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly why?: string | null;

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

  /** Fokus-Sperre for this entry: the default rule, always or never. */
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(FOCUS_BLOCK_OVERRIDES)
  readonly focusBlock?: FocusBlockOverride;
}
