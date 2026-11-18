/** Colour and icon are keys from `campaign.ts`. */
type Campaign = {
  id: number;
  title: string;
  color: string | null;
  icon: string | null;
};

/** The three answers of a review; null where nothing was written. */
export type WeekReviewAnswers = {
  wentWell: string | null;
  wentBadly: string | null;
  changeNext: string | null;
};

/** What PUT /week-review/:week takes; an empty answer is stored as none. */
export type WeekReviewInput = {
  wentWell: string;
  wentBadly: string;
  changeNext: string;
};

/** Where a campaign stood: quests done of all, the campaign included. */
export type WeekReviewStanding = {
  doneCount: number;
  totalCount: number;
  percentage: number;
  /** "reconstructed": read back from creation and completion times. */
  source: "snapshot" | "live" | "reconstructed";
};

/** A goal that counts a daily: runs against its target. */
export type WeekReviewDailyGoal = {
  todoId: number;
  habitId: number;
  habitTitle: string;
  target: number;
  before: number;
  after: number;
};

export type WeekReviewCampaign = {
  campaign: Campaign;
  start: WeekReviewStanding;
  end: WeekReviewStanding;
  dailyGoals: WeekReviewDailyGoal[];
};

/** A completed quest or a resolved run of the week. */
export type WeekReviewItem = {
  type: "todo" | "habit";
  id: number;
  title: string;
  status: "completed" | "skipped";
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
  /** As in the calendar's week; null when no daily was due. */
  weekQuota: { completed: number; total: number; percentage: number } | null;
  /** Null when no category has a weekly target. */
  perfectWeek: {
    perfect: boolean;
    categories: {
      id: number;
      name: string;
      target: number;
      completed: number;
      reached: boolean;
    }[];
  } | null;
  /** Monday to Sunday. */
  days: { date: string; items: WeekReviewItem[] }[];
  answers: WeekReviewAnswers;
};
