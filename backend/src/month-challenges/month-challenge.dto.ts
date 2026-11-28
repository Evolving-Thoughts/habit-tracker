import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  IsTimeOfDay,
  TIME_OF_DAY_MESSAGE,
} from '../common/validation/field-rules';
import type { ChallengeStatus } from './challenge-rules';

/**
 * POST /month-challenges: a Daily for this month or the next. Without
 * `reminderTime` the reminder comes at 19:00; null switches it off.
 */
export class CreateMonthChallengeDto {
  @IsInt()
  @Min(1)
  readonly habitId!: number;

  /** "YYYY-MM": this month or the next one. */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Der Monat muss als JJJJ-MM kommen.' })
  readonly month!: string;

  // Null passes too: no reminder.
  @IsOptional()
  @IsString()
  @IsTimeOfDay({ message: TIME_OF_DAY_MESSAGE })
  readonly reminderTime?: string | null;
}

/** PATCH /month-challenges/:id: the reminder time; null switches it off. */
export class UpdateMonthChallengeDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsTimeOfDay({ message: TIME_OF_DAY_MESSAGE })
  readonly reminderTime!: string | null;
}

export type MonthChallengeResponse = {
  id: number;
  /** "YYYY-MM". */
  month: string;
  /** The first counted day: the month's first, or the day it began. */
  startDate: string;
  /** The month's last day. */
  endDate: string;
  /** The Daily; null once it was deleted. */
  habitId: number | null;
  /** The Daily's title, kept after it was deleted. */
  title: string;
  /** The daily reminder, "HH:MM" in Berlin; null for none. */
  reminderTime: string | null;
  status: ChallengeStatus;
  /** When it was ended early (by hand, or because its Daily was deleted). */
  endedAt: string | null;
  /** Today's day of the challenge, 1 on its first; null outside its days. */
  day: number | null;
  /** How many days it counts, from `startDate` to `endDate`. */
  days: number;
  /** Due runs done so far, or in all once closed. */
  done: number;
  /** Due runs that can no longer be done. */
  missed: number;
  /** Due runs still possible; 0 once closed. */
  remaining: number;
  /** All due runs: done + missed + remaining. */
  total: number;
  /** Whole percent of `total` done, rounded down. */
  percent: number;
  /** Today's run while it runs: open (to be done today), done, or none due. */
  todayRun: 'open' | 'done' | 'none';
  /** The open run of today, for its check and ▶. */
  todayOccurrenceId: number | null;
};

/** GET /month-challenges. */
export type MonthChallengesResponse = {
  /** The Berlin day the server counts as today. */
  today: string;
  /** This month's challenge, running or ended. */
  current: MonthChallengeResponse | null;
  /** Next month's, prepared ahead. */
  next: MonthChallengeResponse | null;
  /** Earlier months, newest first. */
  past: MonthChallengeResponse[];
};
