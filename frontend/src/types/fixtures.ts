/** Empty optional content of API responses, for test data. */
export const TODO_FIELDS = {
  categoryId: null,
  why: null,
  inheritedWhy: null,
  periodStart: null,
  periodEnd: null,
  goalHabitId: null,
  goalTarget: null,
  weeklyTargetMinutes: null,
  color: null,
  icon: null,
  campaign: null,
  blocked: false,
  setAsideAt: null,
};

/** What `GET /todos/hierarchy` adds to a quest nobody is working on. */
export const HIERARCHY_FIELDS = { inProgress: false };

/** A Daily without a series yet. */
export const NO_STREAK = { current: 0, best: 0, unit: "runs" as const };

export const HABIT_FIELDS = {
  streak: NO_STREAK,
  categoryId: null,
  campaignId: null,
  campaign: null,
  why: null,
  inheritedWhy: null,
  timeOfDay: null,
};

const PLANNER_CONTEXT = {
  why: null,
  goal: null,
  campaign: null,
  workedMinutes: 0,
};

export const PLANNER_TODO_FIELDS = {
  categoryName: null,
  categoryColor: null,
  timeOfDay: null,
  ...PLANNER_CONTEXT,
};

export const PLANNER_HABIT_FIELDS = {
  streak: NO_STREAK,
  categoryName: null,
  categoryColor: null,
  timeOfDay: null,
  ...PLANNER_CONTEXT,
};

/** Heute without measured quest time and without a weekly goal. */
export const NO_QUEST_HOURS = {
  todayMinutes: 0,
  weekMinutes: 0,
  weeklyTargetMinutes: null,
};

export const WEEK_ENTRY_FIELDS = {
  timeOfDay: null,
  plannedDurationMinutes: null,
  campaign: null,
  isOverdue: false,
};

/** What a daily run of the Plan carries beside the entry fields. */
export const WEEK_HABIT_FIELDS = {
  moveUntil: null,
  timerEligible: false,
  streak: NO_STREAK,
};

const HISTORY_CONTEXT = {
  categoryName: null,
  categoryColor: null,
  why: null,
  campaign: null,
};

export const HISTORY_ITEM_FIELDS = { ...HISTORY_CONTEXT, timeOfDay: null };

export const PLANNED_FIELDS = {
  ...HISTORY_CONTEXT,
  timeOfDay: null,
  moveUntil: null,
};
