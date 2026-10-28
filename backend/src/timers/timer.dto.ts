import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TIMER_MAX_MINUTES, TIMER_MIN_MINUTES } from './timer-target';
export class StartTimerDto {
  @IsIn(['todo', 'occurrence'])
  kind!: 'todo' | 'occurrence';
  @IsInt()
  @Min(1)
  targetId!: number;
  @IsOptional()
  @IsInt()
  @Min(TIMER_MIN_MINUTES)
  @Max(TIMER_MAX_MINUTES)
  durationMinutes?: number;
  @IsOptional()
  @IsUUID()
  replaceTimerId?: string;
}
export class ChangeTimerDurationDto {
  @IsInt()
  @Min(TIMER_MIN_MINUTES)
  @Max(TIMER_MAX_MINUTES)
  durationMinutes!: number;
}
