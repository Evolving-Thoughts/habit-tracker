import { IsString } from 'class-validator';
import { IsDay } from './validation/field-rules';

/**
 * `?week=YYYY-MM-DD` of the weekly reads; the services check with
 * `weekDates` that it is a real Monday.
 */
export class WeekQueryDto {
  @IsString()
  @IsDay()
  readonly week!: string;
}
