import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { PerfectWeek } from '../history/perfect-week';
import type { WeekQuota } from '../history/week-quota';
import type { Campaign } from '../todos/todo-ancestry';

/** Like the daily reflection: up to 10,000 characters per answer. */
export const MAX_ANSWER_LENGTH = 10000;

/** PUT /week-review/:week: each answer is optional; empty stores nothing. */
export class SaveWeekReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANSWER_LENGTH)
  readonly wentWell?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANSWER_LENGTH)
  readonly wentBadly?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANSWER_LENGTH)
  readonly changeNext?: string | null;
}

/** The three answers of a review; null where nothing was written. */
export type WeekReviewAnswers = {
  wentWell: string | null;
  wentBadly: string | null;
  changeNext: string | null;
};

/**
 * Where a campaign stood: its quests done against all of them, the campaign
 * itself not counted, as in the burn-up. `source` says where the numbers come
 * from: a stored snapshot, the live todos, or creation and completion times
 * read back when no snapshot covers the moment.
 */
export type WeekReviewStanding = {
  doneCount: number;
  totalCount: number;
  /** Whole percent; 0 without any quest. */
  percentage: number;
  source: 'snapshot' | 'live' | 'reconstructed';
};

/** A goal in the campaign that counts a daily: runs against its target. */
export type WeekReviewDailyGoal = {
  todoId: number;
  habitId: number;
  habitTitle: string;
  target: number;
  /** Runs counted when the week began. */
  before: number;
  /** Runs counted at its end, or today in the running week. */
  after: number;
};

export type WeekReviewCampaign = {
  campaign: Campaign;
  /** When the week began. */
  start: WeekReviewStanding;
  /** When it ended; today in the running week. */
  end: WeekReviewStanding;
  dailyGoals: WeekReviewDailyGoal[];
};

/** A completed quest or a resolved run of the week. */
export type WeekReviewItem = {
  type: 'todo' | 'habit';
  id: number;
  title: string;
  status: 'completed' | 'skipped';
  /** When it was resolved; null for older runs without the moment. */
  resolvedAt: string | null;
  deleted: boolean;
  campaign: Campaign | null;
};

export type WeekReviewResponse = {
  /** The Monday the week starts on. */
  startDate: string;
  endDate: string;
  today: string;
  /** Campaigns active in the week, most quests done this week first. */
  campaigns: WeekReviewCampaign[];
  /** Null when no daily was due. */
  weekQuota: WeekQuota | null;
  /** Null when no category has a weekly target. */
  perfectWeek: PerfectWeek | null;
  /**
   * The Monats-Challenge of the month of the week's last day (today in the
   * running week), as it stood then: runs done of those decided. Null
   * without one begun by then.
   */
  monthChallenge: { title: string; done: number; due: number } | null;
  /** Monday to Sunday, each with what was resolved that day. */
  days: { date: string; items: WeekReviewItem[] }[];
  answers: WeekReviewAnswers;
};
