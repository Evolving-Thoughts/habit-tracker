import {
  FOCUS_BLOCK_OVERRIDES,
  type FocusBlockOverride,
} from '../../focus-blocks/focus-block-rules';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
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

export const BACKLOG_PLACES = ['top', 'bottom'] as const;
export type BacklogPlace = (typeof BACKLOG_PLACES)[number];

export class CreateTodoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly parentId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly categoryId?: number | null;

  @IsWhy()
  readonly why?: string | null;

  @IsTitle()
  readonly title!: string;

  /** The day as YYYY-MM-DD; null puts the todo back into the backlog. */
  @IsOptional()
  @IsDay()
  readonly scheduledDate?: string | null;

  /**
   * Without a day: where the quest joins the Questlog's order, at its head
   * or (the default) its end. Ignored with a day.
   */
  @IsOptional()
  @IsIn(BACKLOG_PLACES)
  readonly backlogPlace?: BacklogPlace;

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
}
