import { Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ScheduleDto } from './schedule.dto';

export class ChangeHabitScheduleDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly effectiveFrom?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ScheduleDto)
  readonly schedule!: ScheduleDto;
}
