import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { MAX_WEEKLY_TARGET_MINUTES } from '../todos/campaign-style';
import type { Campaign } from '../todos/todo-ancestry';

/**
 * PUT /quest-hours/target: the overall weekly goal from the running week on;
 * null removes it. Weeks that are over keep theirs.
 */
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
  /** Every quest minute ever measured, on any campaign (overlap once). */
  totalQuestMinutes: number;
  /** Monday to Sunday. */
  days: QuestHoursDay[];
  /**
   * The eight weeks up to and including this one, oldest first, each split
   * like the days: quest minutes and the rest of the measured time.
   */
  weeks: { startDate: string; questMinutes: number; otherMinutes: number }[];
  /** Campaigns with measured time or a weekly goal, most time this week first. */
  campaigns: QuestHoursCampaign[];
};

/** What Heute shows of the quest hours. */
export type QuestHoursToday = {
  todayMinutes: number;
  weekMinutes: number;
  weeklyTargetMinutes: number | null;
};
