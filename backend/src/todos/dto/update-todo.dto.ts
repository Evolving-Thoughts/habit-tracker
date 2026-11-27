import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
import {
  IsBoolean,
  IsDateString,
  IsIn,
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

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly why?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @IsOptional()
  @IsBoolean()
  readonly completed?: boolean;

  /** The day as YYYY-MM-DD; null puts the todo back into the backlog. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly scheduledDate?: string | null;

  /** HH:mm makes it an appointment fixed to that time; needs a day. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  readonly timeOfDay?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
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
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(FOCUS_BLOCK_OVERRIDES)
  readonly focusBlock?: FocusBlockOverride;

  /** Marks or unmarks it as "Geblockt"; only an open todo can be blocked. */
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly blocked?: boolean;
}
