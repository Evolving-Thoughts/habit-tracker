/** Only a quest without parent may carry these (keys from `campaign.ts`). */
export type CampaignInput = {
  /** Minutes of quest time to reach each week. */
  weeklyTargetMinutes?: number | null;
  color?: string | null;
  icon?: string | null;
};

export type CreateTodoInput = CampaignInput & {
  parentId?: number | null;
  categoryId?: number | null;
  why?: string | null;
  title: string;
  /** YYYY-MM-DD of the planned day; null keeps the quest in the Questlog. */
  scheduledDate: string | null;
  /** HH:mm makes it an appointment fixed to that time; needs a day. */
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
};

export type TodoGoalInput = {
  periodStart?: string | null;
  periodEnd?: string | null;
  goalHabitId?: number | null;
  goalTarget?: number | null;
};

export type UpdateTodoInput = Partial<CreateTodoInput> & TodoGoalInput;

/** A reason taken over from the entry above, and which one that is. */
export type InheritedWhy = { text: string; fromId: number; fromTitle: string };

export type TodoResponse = Required<TodoGoalInput> & {
  id: number;
  /** Campaign only: weekly goal in minutes, colour and icon. */
  weeklyTargetMinutes: number | null;
  color: string | null;
  icon: string | null;
  /** Parent in the todo hierarchy; null for a root. */
  parentId: number | null;
  categoryId: number | null;
  /** The quest's own reason. */
  why: string | null;
  /** What it takes over from a quest above it while it has none. */
  inheritedWhy: InheritedWhy | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  /** Server-side timer-target rule: may a timer run for this todo? */
  timerEligible: boolean;
};
