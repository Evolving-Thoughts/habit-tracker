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

export class CreateTodoDto {
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

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
