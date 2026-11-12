/** Empty optional content of API responses, for test data. */
export const TODO_FIELDS = {
  categoryId: null,
  why: null,
  periodStart: null,
  periodEnd: null,
  goalHabitId: null,
  goalTarget: null,
};

export const HABIT_FIELDS = { categoryId: null, why: null, timeOfDay: null };

const PLANNER_CONTEXT = { why: null, goal: null, workedMinutes: 0 };

export const PLANNER_TODO_FIELDS = { categoryName: null, ...PLANNER_CONTEXT };

export const PLANNER_HABIT_FIELDS = {
  categoryName: null,
  timeOfDay: null,
  ...PLANNER_CONTEXT,
};

const HISTORY_CONTEXT = { categoryName: null, why: null };

export const HISTORY_ITEM_FIELDS = HISTORY_CONTEXT;

export const PLANNED_FIELDS = {
  ...HISTORY_CONTEXT,
  isFixed: false,
  moveUntil: null,
};
