/**
 * A Monats-Challenge: one Daily held for a calendar month (see
 * docs/challenges.md). The counting is the server's; the views read it.
 */
export type MonthChallenge = {
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
  status: "upcoming" | "running" | "succeeded" | "finished" | "ended";
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
  todayRun: "open" | "done" | "none";
  /** The open run of today, for its check and ▶. */
  todayOccurrenceId: number | null;
};

/** GET /month-challenges */
export type MonthChallenges = {
  /** The Berlin day the server counts as today. */
  today: string;
  /** This month's challenge, running or ended. */
  current: MonthChallenge | null;
  /** Next month's, prepared ahead. */
  next: MonthChallenge | null;
  /** Earlier months, newest first. */
  past: MonthChallenge[];
};

/** POST /month-challenges: without a time the reminder comes at 19:00. */
export type CreateMonthChallengeInput = {
  habitId: number;
  /** "YYYY-MM": this month or the next. */
  month: string;
  /** "HH:MM"; null for no reminder. */
  reminderTime?: string | null;
};

/** PATCH /month-challenges/:id */
export type UpdateMonthChallengeInput = {
  /** "HH:MM"; null for no reminder. */
  reminderTime: string | null;
};
