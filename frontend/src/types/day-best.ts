/** One day's line of "Das Beste des Tages". */
export type DayBest = { date: string; text: string };

/** GET /day-bests?from&to */
export type DayBestRange = {
  /** Newest first. */
  entries: DayBest[];
};

/** GET /day-bests/months */
export type DayBestMonths = {
  /** The Berlin day the server counts as today. */
  today: string;
  /** Every month with at least one line, newest first ("YYYY-MM"). */
  months: { month: string; count: number }[];
};

/** GET and PUT /day-best-settings */
export type DayBestSettings = {
  /** From when Heute asks for the line, "HH:MM" in Berlin. */
  cardTime: string;
  /** An evening push an hour later, while the day still has no line. */
  reminderEnabled: boolean;
};
