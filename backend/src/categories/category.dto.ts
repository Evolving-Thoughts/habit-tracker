import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CategoryInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  readonly name!: string;
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
}

export type CategoryResponse = {
  id: number;
  name: string;
  weeklyTarget: number | null;
};
