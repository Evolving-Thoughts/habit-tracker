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
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  readonly isActive?: boolean;
}
