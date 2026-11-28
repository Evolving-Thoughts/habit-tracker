import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  IsDay,
  IsPlannedMinutes,
  IsTimeOfDay,
  IsTitle,
  IsWhy,
  OptionalNotNull,
} from '../../common/validation/field-rules';
import {
  CAMPAIGN_COLORS,
  CAMPAIGN_ICONS,
  CampaignColor,
  CampaignIcon,
  MAX_WEEKLY_TARGET_MINUTES,
} from '../campaign-style';

export class UpdateTodoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly parentId?: number | null;

  @IsOptional()
  @IsDateString({ strict: true })
  readonly periodStart?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  readonly periodEnd?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly goalHabitId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly goalTarget?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly categoryId?: number | null;

  @IsWhy()
  readonly why?: string | null;

  @OptionalNotNull()
  @IsTitle()
  readonly title?: string;

  @OptionalNotNull()
  @IsBoolean()
  readonly completed?: boolean;

  /** The day as YYYY-MM-DD; null puts the todo back into the backlog. */
  @IsOptional()
  @IsDay()
  readonly scheduledDate?: string | null;

  /** HH:mm makes it an appointment fixed to that time; needs a day. */
  @IsOptional()
  @IsTimeOfDay()
  readonly timeOfDay?: string | null;

  @IsOptional()
  @IsPlannedMinutes()
  readonly plannedDurationMinutes?: number | null;

  /** Campaign only (no parent): weekly goal of quest minutes. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_WEEKLY_TARGET_MINUTES)
  readonly weeklyTargetMinutes?: number | null;

  @IsOptional()
  @IsIn(CAMPAIGN_COLORS)
  readonly color?: CampaignColor | null;

  @IsOptional()
  @IsIn(CAMPAIGN_ICONS)
  readonly icon?: CampaignIcon | null;

  /** Fokus-Sperre for this entry: the default rule, always or never. */
  @OptionalNotNull()
  @IsIn(FOCUS_BLOCK_OVERRIDES)
  readonly focusBlock?: FocusBlockOverride;

  /** Marks or unmarks it as "Geblockt"; only an open todo can be blocked. */
  @OptionalNotNull()
  @IsBoolean()
  readonly blocked?: boolean;
}
