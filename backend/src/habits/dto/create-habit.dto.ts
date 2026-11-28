import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsString,
  IsOptional,
  IsInt,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import {
  IsCalendarDay,
  IsPlannedMinutes,
  IsTimeOfDay,
  IsTitle,
  IsWhy,
  OptionalNotNull,
} from '../../common/validation/field-rules';
import { ScheduleDto } from './schedule.dto';

export class CreateHabitDto {
  @IsOptional()
  @IsPlannedMinutes()
  readonly plannedDurationMinutes?: number | null;

  @IsOptional()
  @IsString()
  @IsTimeOfDay()
  readonly timeOfDay?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly categoryId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly campaignId?: number | null;

  @IsWhy()
  readonly why?: string | null;

  @IsTitle()
  readonly title!: string;

  @OptionalNotNull()
  @IsCalendarDay()
  readonly startDate?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ScheduleDto)
  readonly schedule!: ScheduleDto;

  /** Fokus-Sperre for this entry: the default rule, always or never. */
  @OptionalNotNull()
  @IsIn(FOCUS_BLOCK_OVERRIDES)
  readonly focusBlock?: FocusBlockOverride;
}
