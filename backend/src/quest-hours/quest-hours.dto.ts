import {
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_WEEKLY_TARGET_MINUTES } from '../todos/campaign-style';
import type { Campaign } from '../todos/todo-ancestry';

/** GET /quest-hours?week=YYYY-MM-DD; `week` must be a Monday. */
export class QuestHoursQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly week!: string;
}

/** PUT /quest-hours/target: the overall weekly goal; null removes it. */
export class QuestTargetDto {
  @ValidateIf((dto: QuestTargetDto) => dto.weeklyTargetMinutes !== null)
  @IsInt()
  @Min(1)
  @Max(MAX_WEEKLY_TARGET_MINUTES)
  readonly weeklyTargetMinutes!: number | null;
}

export type QuestTargetResponse = { weeklyTargetMinutes: number | null };

export type QuestHoursDay = {
  date: string;
  /** Minutes on stretches that count for a campaign. */
  questMinutes: number;
  /** The rest of the day's worked minutes. */
  otherMinutes: number;
};

export type QuestHoursCampaign = {
  campaign: Campaign;
  /** Quest minutes in the asked-for week. */
  minutes: number;
  weeklyTargetMinutes: number | null;
  /** Minutes in each week of `weeks`, oldest first. */
  weeks: number[];
  /** Every quest minute ever measured for it. */
  totalMinutes: number;
};

export type QuestHoursResponse = {
  /** The Monday the week starts on. */
  startDate: string;
  endDate: string;
  today: string;
  /** The overall weekly goal; null without one. */
  weeklyTargetMinutes: number | null;
  questMinutes: number;
  otherMinutes: number;
  /** Monday to Sunday. */
  days: QuestHoursDay[];
  /** The eight weeks up to and including this one, oldest first. */
  weeks: { startDate: string; questMinutes: number }[];
  /** Campaigns with measured time or a weekly goal, most time this week first. */
  campaigns: QuestHoursCampaign[];
};

/** What Heute shows of the quest hours. */
export type QuestHoursToday = {
  todayMinutes: number;
  weekMinutes: number;
  weeklyTargetMinutes: number | null;
};
