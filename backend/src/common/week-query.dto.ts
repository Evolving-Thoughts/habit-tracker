import { IsString, Matches } from 'class-validator';

/**
 * `?week=YYYY-MM-DD` of the weekly reads; the services check with
 * `weekDates` that it is a real Monday.
 */
export class WeekQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly week!: string;
}
