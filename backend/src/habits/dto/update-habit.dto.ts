import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateHabitDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  readonly plannedDurationMinutes?: number | null;
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly categoryId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly why?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly isActive?: boolean;
}
