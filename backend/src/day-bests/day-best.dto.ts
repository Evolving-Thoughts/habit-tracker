import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DAY_BEST_MAX_LENGTH } from './day-best.entities';
import { normalizeDayBestText } from './day-best-rules';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** "HH:MM", 00:00 to 23:59. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * PUT /day-bests/:date. The line is trimmed and its whitespace collapsed to
 * single spaces before the limit applies; empty removes the day's line.
 */
export class SaveDayBestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeDayBestText(value) : value,
  )
  @IsString()
  @MaxLength(DAY_BEST_MAX_LENGTH)
  readonly text!: string;
}

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD` of GET /day-bests, both included. */
export class DayBestRangeDto {
  @IsString()
  @Matches(DATE_PATTERN)
  readonly from!: string;

  @IsString()
  @Matches(DATE_PATTERN)
  readonly to!: string;
}

/** PUT /day-best-settings: either or both; what is left out stays. */
export class SaveDayBestSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'Die Uhrzeit muss als HH:MM kommen.' })
  readonly cardTime?: string;

  @IsOptional()
  @IsBoolean()
  readonly reminderEnabled?: boolean;
}

export type DayBestResponse = { date: string; text: string };

export type DayBestRangeResponse = {
  /** Newest first. */
  entries: DayBestResponse[];
};

export type DayBestMonthsResponse = {
  /** The Berlin day the server counts as today. */
  today: string;
  /** Every month with at least one line, newest first ("YYYY-MM"). */
  months: { month: string; count: number }[];
};

export type DayBestSettingsResponse = {
  /** From when Heute asks for the line, "HH:MM" in Berlin. */
  cardTime: string;
  /** An evening push an hour later, while the day still has no line. */
  reminderEnabled: boolean;
};
