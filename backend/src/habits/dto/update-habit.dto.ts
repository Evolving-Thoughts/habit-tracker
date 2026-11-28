import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import {
  IsPlannedMinutes,
  IsTimeOfDay,
  IsHabitTitle,
  IsWhy,
  OptionalNotNull,
} from '../../common/validation/field-rules';

export class UpdateHabitDto {
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

  @OptionalNotNull()
  @IsHabitTitle()
  readonly title?: string;

  @OptionalNotNull()
  @IsBoolean()
  readonly isActive?: boolean;

  /** Fokus-Sperre for this entry: the default rule, always or never. */
  @OptionalNotNull()
  @IsIn(FOCUS_BLOCK_OVERRIDES)
  readonly focusBlock?: FocusBlockOverride;
}
