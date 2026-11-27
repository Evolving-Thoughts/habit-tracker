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
  /** Fokus-Sperre: the default rule, always or never (see focus-block.ts). */
  focusBlock?: "default" | "always" | "never";
  /** Without a day: the head or (default) the end of the Questlog's order. */
  backlogPlace?: "top" | "bottom";
};

export type TodoGoalInput = {
  periodStart?: string | null;
  periodEnd?: string | null;
  goalHabitId?: number | null;
  goalTarget?: number | null;
};

export type UpdateTodoInput = Partial<Omit<CreateTodoInput, "backlogPlace">> &
  TodoGoalInput & {
    /** Held up by something outside the quest (set on the campaign board). */
    blocked?: boolean;
  };

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
  /** The campaign it works towards (the topmost quest above); null when loose. */
  campaign: {
    id: number;
    title: string;
    color: string | null;
    icon: string | null;
  } | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledDate: string | null;
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  /** Fokus-Sperre: the default rule, always or never (see focus-block.ts). */
  focusBlock?: "default" | "always" | "never";
  /** Server-side timer-target rule: may a timer run for this todo? */
  timerEligible: boolean;
  /** Held up by something outside it; the campaign board says "Geblockt". */
  blocked: boolean;
  /** When work on it was last set aside (`POST /todos/:id/set-aside`). */
  setAsideAt: string | null;
};
