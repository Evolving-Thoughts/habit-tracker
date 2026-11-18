import { addDays, dayOf, endOfDay, startOfDay } from '../common/date/local-day';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { GoalScope, rootIds, scopesByRoot } from '../todos/goal-scope';
import { countedRuns } from '../todos/habit-goal';
import type { Campaign } from '../todos/todo-ancestry';
import type {
  WeekReviewAnswers,
  WeekReviewCampaign,
  WeekReviewDailyGoal,
  WeekReviewItem,
  WeekReviewStanding,
} from './week-review.dto';

/** The week under review and the app's today. */
export type ReviewWeek = { startDate: string; endDate: string; today: string };

export const NO_ANSWERS: WeekReviewAnswers = {
  wentWell: null,
  wentBadly: null,
  changeNext: null,
};

const answer = (text: string | null | undefined): string | null =>
  text?.trim() || null;

/**
 * The answers as they are stored: trimmed, an empty one is null. Null when
 * all three are empty, so such a review keeps no row.
 */
export function answersOf(input: {
  wentWell?: string | null;
  wentBadly?: string | null;
  changeNext?: string | null;
}): WeekReviewAnswers | null {
  const answers = {
    wentWell: answer(input.wentWell),
    wentBadly: answer(input.wentBadly),
    changeNext: answer(input.changeNext),
  };
  return Object.values(answers).some((value) => value !== null)
    ? answers
    : null;
}

/** A live todo with what its progress and its goal need. */
export type ProgressTodo = {
  id: number;
  parentId: number | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  plannedDurationMinutes: number | null;
  goalHabitId: number | null;
  goalTarget: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type SnapshotRow = {
  rootTodoId: number;
  date: string;
  doneCount: number;
  totalCount: number;
};

/** A campaign is reviewed in a week it existed in and had not finished before. */
export function isActiveIn(
  root: Pick<ProgressTodo, 'createdAt' | 'completed' | 'completedAt'>,
  week: ReviewWeek,
): boolean {
  const finishedBefore =
    root.completed &&
    root.completedAt !== null &&
    root.completedAt < startOfDay(week.startDate);
  return root.createdAt < endOfDay(week.endDate) && !finishedBefore;
}

/** Whether a goal that counts a daily runs during some day of the week. */
export function countsInWeek(
  todo: Pick<
    ProgressTodo,
    'goalHabitId' | 'goalTarget' | 'periodStart' | 'periodEnd'
  >,
  week: ReviewWeek,
): boolean {
  return (
    todo.goalHabitId !== null &&
    todo.goalTarget !== null &&
    todo.periodStart !== null &&
    todo.periodEnd !== null &&
    todo.periodStart <= week.endDate &&
    todo.periodEnd >= week.startDate
  );
}

/**
 * Each root's scope at `instant`, read back from the live todos: those
 * created by then, done when completed by then. A completed todo without a
 * completion time counts as done. Deleted todos and reopened completions
 * leave no trace, which is why a stored snapshot is preferred.
 */
export function scopesAt(
  todos: ProgressTodo[],
  instant: Date,
): Map<number, GoalScope> {
  const then = todos.map((todo) => ({
    ...todo,
    completed:
      todo.completed &&
      (todo.completedAt === null || todo.completedAt < instant),
  }));
  return byRoot(scopesByRoot(then, (todo) => todo.createdAt < instant));
}

const byRoot = (scopes: GoalScope[]): Map<number, GoalScope> =>
  new Map(scopes.map((scope) => [scope.rootTodoId, scope]));

function standing(
  scope: { doneCount: number; totalCount: number } | undefined,
  source: WeekReviewStanding['source'],
): WeekReviewStanding {
  const doneCount = scope?.doneCount ?? 0;
  const totalCount = scope?.totalCount ?? 0;
  return {
    doneCount,
    totalCount,
    percentage: totalCount ? Math.round((doneCount / totalCount) * 100) : 0,
    source,
  };
}

/** The latest snapshot of a root dated `from`..`to`, if there is one. */
function latestSnapshot(
  snapshots: SnapshotRow[],
  rootTodoId: number,
  from: string,
  to: string,
): SnapshotRow | undefined {
  let latest: SnapshotRow | undefined;
  for (const row of snapshots)
    if (
      row.rootTodoId === rootTodoId &&
      row.date >= from &&
      row.date <= to &&
      (!latest || row.date > latest.date)
    )
      latest = row;
  return latest;
}

/**
 * Where each campaign stood when the week began and when it ended.
 *
 * - Start: the latest snapshot of the seven days before Monday (a snapshot
 *   holds the last state of its day); without one, the state read back from
 *   creation and completion times at Monday 00:00.
 * - End: the live todos for the running week; for a past week the latest
 *   snapshot dated in the week, else the state read back at its end.
 * - A week still ahead shows the live state on both sides.
 *
 * Daily goals in the campaign whose period touches the week count their
 * runs up to Sunday before and up to the week's last day.
 */
export function campaignProgress(
  campaigns: Campaign[],
  todos: ProgressTodo[],
  snapshots: SnapshotRow[],
  runs: { habitId: number; resolvedDate: string | null }[],
  habitTitles: ReadonlyMap<number, string>,
  week: ReviewWeek,
): WeekReviewCampaign[] {
  const ahead = week.startDate > week.today;
  const finished = week.endDate < week.today;
  const live = byRoot(scopesByRoot(todos));
  const atStart = ahead ? live : scopesAt(todos, startOfDay(week.startDate));
  const atEnd = finished ? scopesAt(todos, endOfDay(week.endDate)) : live;
  const dayBefore = addDays(week.startDate, -1);

  const startOf = (id: number): WeekReviewStanding => {
    if (ahead) return standing(live.get(id), 'live');
    const snapshot = latestSnapshot(
      snapshots,
      id,
      addDays(week.startDate, -7),
      dayBefore,
    );
    return snapshot
      ? standing(snapshot, 'snapshot')
      : standing(atStart.get(id), 'reconstructed');
  };
  const endOf = (id: number): WeekReviewStanding => {
    if (!finished) return standing(live.get(id), 'live');
    const snapshot = latestSnapshot(
      snapshots,
      id,
      week.startDate,
      week.endDate,
    );
    return snapshot
      ? standing(snapshot, 'snapshot')
      : standing(atEnd.get(id), 'reconstructed');
  };

  const roots = rootIds(todos);
  const goals = new Map<number, WeekReviewDailyGoal[]>();
  for (const todo of todos) {
    if (!countsInWeek(todo, week)) continue;
    const root = roots.get(todo.id)!;
    const list = goals.get(root) ?? [];
    list.push({
      todoId: todo.id,
      habitId: todo.goalHabitId!,
      habitTitle: habitTitles.get(todo.goalHabitId!) ?? '',
      target: todo.goalTarget!,
      before: countedRuns(todo, runs, dayBefore),
      after: countedRuns(todo, runs, week.endDate),
    });
    goals.set(root, list);
  }

  const rows = campaigns.map((campaign) => ({
    campaign,
    start: startOf(campaign.id),
    end: endOf(campaign.id),
    dailyGoals: goals.get(campaign.id) ?? [],
  }));
  const gained = (row: WeekReviewCampaign): number =>
    row.end.doneCount - row.start.doneCount;
  return rows.sort(
    (a, b) =>
      gained(b) - gained(a) ||
      a.campaign.title.localeCompare(b.campaign.title, 'de') ||
      a.campaign.id - b.campaign.id,
  );
}

/** A completed todo as the done list needs it. */
export type DoneTodo = {
  id: number;
  title: string;
  completedAt: Date | null;
  deletedAt: Date | null;
};

/** A resolved run with its habit. */
export type DoneRun = {
  id: number;
  habitId: number;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  resolvedDate: string | null;
  resolvedAt: Date | null;
  habit: { title: string; deletedAt: Date | null };
};

/**
 * What was resolved on each day of the week, in the order it happened: a
 * quest on the day it was completed, a run on the day it was done, a skipped
 * run on the day it was due (the calendar's rules).
 */
export function doneDays(
  week: ReviewWeek,
  todos: DoneTodo[],
  runs: DoneRun[],
  campaignOf: {
    todo: (id: number) => Campaign | null;
    habit: (habitId: number) => Campaign | null;
  },
): { date: string; items: WeekReviewItem[] }[] {
  const resolved: { date: string; item: WeekReviewItem }[] = [
    ...todos.flatMap((todo) =>
      todo.completedAt
        ? [
            {
              date: dayOf(todo.completedAt),
              item: {
                type: 'todo' as const,
                id: todo.id,
                title: todo.title,
                status: 'completed' as const,
                resolvedAt: todo.completedAt.toISOString(),
                deleted: todo.deletedAt !== null,
                campaign: campaignOf.todo(todo.id),
              },
            },
          ]
        : [],
    ),
    ...runs.flatMap((run) => {
      const completed = run.status === HabitOccurrenceStatus.COMPLETED;
      if (!completed && run.status !== HabitOccurrenceStatus.SKIPPED) return [];
      const date = completed ? run.resolvedDate : run.scheduledDate;
      if (!date) return [];
      return [
        {
          date,
          item: {
            type: 'habit' as const,
            id: run.id,
            title: run.habit.title,
            status: completed ? ('completed' as const) : ('skipped' as const),
            resolvedAt: run.resolvedAt?.toISOString() ?? null,
            deleted: run.habit.deletedAt !== null,
            campaign: campaignOf.habit(run.habitId),
          },
        },
      ];
    }),
  ];
  resolved.sort(
    ({ item: a }, { item: b }) =>
      (a.resolvedAt ?? '').localeCompare(b.resolvedAt ?? '') ||
      a.title.localeCompare(b.title, 'de') ||
      a.type.localeCompare(b.type) ||
      a.id - b.id,
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week.startDate, index);
    return {
      date,
      items: resolved
        .filter((entry) => entry.date === date)
        .map(({ item }) => item),
    };
  });
}
