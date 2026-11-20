import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CAMPAIGN_COLORS, type CampaignColor } from '../todos/campaign-style';

export class CategoryInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  readonly name!: string;

  /** One of the campaign colours; without one the name picks it. */
  @IsOptional()
  @IsIn(CAMPAIGN_COLORS)
  readonly color?: CampaignColor | null;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  readonly name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly weeklyTarget?: number | null;

  /** Null goes back to the colour the name picks. */
  @IsOptional()
  @IsIn(CAMPAIGN_COLORS)
  readonly color?: CampaignColor | null;
}

export type CategoryResponse = {
  id: number;
  name: string;
  weeklyTarget: number | null;
  /** The chosen colour; null while the name picks it. */
  color: CampaignColor | null;
};
