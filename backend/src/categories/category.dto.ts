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

  /** One of the campaign colours; without one it gets the first free core colour. */
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

  /** Null stops choosing: the category shows a colour no other one shows. */
  @IsOptional()
  @IsIn(CAMPAIGN_COLORS)
  readonly color?: CampaignColor | null;
}

export type CategoryResponse = {
  id: number;
  name: string;
  weeklyTarget: number | null;
  /** The colour it shows (`shownCategoryColors`), chosen or not. */
  color: CampaignColor;
  /** False while no colour is stored, so the settings show "Automatisch". */
  colorChosen: boolean;
};
