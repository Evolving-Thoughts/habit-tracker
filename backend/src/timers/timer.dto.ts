import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsPlannedMinutes } from '../common/validation/field-rules';
import { FocusBlockRequestDto } from '../focus-blocks/focus-block.dto';
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
   * Sent by the Fokus-Modus: Soft or Hardcore for the Fokus-Sperre that
   * starts with the stopwatch when the rule calls for one
   * (docs/focus-block.md). Without it the default from Einstellungen.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => FocusBlockRequestDto)
  focusBlock?: FocusBlockRequestDto;
}
/** POST /timers/:id/resume; the Fokus-Modus may send `focusBlock` as on start. */
export class ResumeTimerDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FocusBlockRequestDto)
  focusBlock?: FocusBlockRequestDto;
}
export class ChangeTimerDurationDto {
  @IsPlannedMinutes()
  durationMinutes!: number;
}
