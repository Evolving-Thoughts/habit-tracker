import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
export class StartTimerDto {
  @IsIn(['todo', 'occurrence'])
  kind!: 'todo' | 'occurrence';
  @IsInt()
  @Min(1)
  targetId!: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes?: number;
  @IsOptional()
  @IsUUID()
  replaceTimerId?: string;
}
export class ChangeTimerDurationDto {
  @IsInt()
  @Min(1)
  @Max(10080)
  durationMinutes!: number;
}
