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
};

export const HABIT_FIELDS = {
  categoryId: null,
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
  timeOfDay: null,
  ...PLANNER_CONTEXT,
};

export const PLANNER_HABIT_FIELDS = {
  categoryName: null,
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

const HISTORY_CONTEXT = { categoryName: null, why: null };

export const HISTORY_ITEM_FIELDS = { ...HISTORY_CONTEXT, timeOfDay: null };

export const PLANNED_FIELDS = {
  ...HISTORY_CONTEXT,
  timeOfDay: null,
  moveUntil: null,
};
