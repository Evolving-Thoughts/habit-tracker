import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

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
}
