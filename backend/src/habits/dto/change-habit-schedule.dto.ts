import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import {
  IsCalendarDay,
  OptionalNotNull,
} from '../../common/validation/field-rules';
import { ScheduleDto } from './schedule.dto';

export class ChangeHabitScheduleDto {
  @OptionalNotNull()
  @IsCalendarDay()
  readonly effectiveFrom?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ScheduleDto)
  readonly schedule!: ScheduleDto;
}
