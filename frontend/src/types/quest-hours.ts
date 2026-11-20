export type QuestHoursDay = {
  date: string;
  /** Minutes on quests that belong to a campaign. */
  questMinutes: number;
  /** The rest of the day's measured minutes. */
  otherMinutes: number;
};

export type QuestHoursCampaign = {
  /** Colour and icon are keys from `campaign.ts`. */
  campaign: {
    id: number;
    title: string;
    color: string | null;
    icon: string | null;
  };
  /** Quest minutes in the week asked for. */
  minutes: number;
  weeklyTargetMinutes: number | null;
  /** Minutes in each week of `weeks`, oldest first. */
  weeks: number[];
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
  /** Every quest minute ever measured, on any campaign. */
  totalQuestMinutes: number;
  days: QuestHoursDay[];
  /** The eight weeks up to and including this one, oldest first. */
  weeks: { startDate: string; questMinutes: number }[];
  /** Campaigns with measured time or a weekly goal. */
  campaigns: QuestHoursCampaign[];
};

export type QuestTarget = { weeklyTargetMinutes: number | null };
