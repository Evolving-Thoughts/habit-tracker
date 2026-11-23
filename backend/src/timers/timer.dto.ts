import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FocusBlockRequestDto } from '../focus-blocks/focus-block.dto';
import { TIMER_MAX_MINUTES, TIMER_MIN_MINUTES } from './timer-target';
export class StartTimerDto {
  @IsIn(['todo', 'occurrence'])
  kind!: 'todo' | 'occurrence';
  @IsInt()
  @Min(1)
  targetId!: number;
  @IsOptional()
  @IsUUID()
  replaceTimerId?: string;
  /**
   * Sent by the Fokus-Modus: start a Fokus-Sperre with the stopwatch when
   * the quest or daily calls for one (docs/focus-block.md).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => FocusBlockRequestDto)
  focusBlock?: FocusBlockRequestDto;
}
/** POST /timers/:id/resume; the Fokus-Modus sends `focusBlock` as on start. */
export class ResumeTimerDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FocusBlockRequestDto)
  focusBlock?: FocusBlockRequestDto;
}
export class ChangeTimerDurationDto {
  @IsInt()
  @Min(TIMER_MIN_MINUTES)
  @Max(TIMER_MAX_MINUTES)
  durationMinutes!: number;
}
