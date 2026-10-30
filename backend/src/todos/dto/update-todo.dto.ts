import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTodoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  readonly parentId?: number | null;

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

  @IsOptional()
  @IsDateString()
  readonly scheduledAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly plannedDurationMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  readonly isFixed?: boolean;
}
