import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  answersOf,
  campaignProgress,
  countsInWeek,
  doneDays,
  isActiveIn,
  ProgressTodo,
  ReviewWeek,
  scopesAt,
  SnapshotRow,
} from './week-review';

// The week of Monday 16 to Sunday 22 November 2026; today is the Wednesday.
const RUNNING: ReviewWeek = {
  startDate: '2026-11-16',
  endDate: '2026-11-22',
  today: '2026-11-18',
};
const PAST: ReviewWeek = {
  startDate: '2026-11-09',
  endDate: '2026-11-15',
  today: '2026-11-18',
};
const AHEAD: ReviewWeek = {
  startDate: '2026-11-23',
  endDate: '2026-11-29',
  today: '2026-11-18',
};

const at = (iso: string) => new Date(iso);
const todo = (
  id: number,
  parentId: number | null,
  overrides: Partial<ProgressTodo> = {},
): ProgressTodo => ({
  id,
  parentId,
  completed: false,
  completedAt: null,
  createdAt: at('2026-11-01T10:00:00Z'),
  plannedDurationMinutes: null,
  goalHabitId: null,
  goalTarget: null,
  periodStart: null,
  periodEnd: null,
  ...overrides,
});
const done = (iso: string): Partial<ProgressTodo> => ({
  completed: true,
  completedAt: at(iso),
});
const campaign = { id: 1, title: 'Buch', color: null, icon: null };
const snapshot = (
  date: string,
  doneCount: number,
  totalCount: number,
  rootTodoId = 1,
): SnapshotRow => ({ rootTodoId, date, doneCount, totalCount });

describe('answersOf', () => {
  it('trims the answers and stores an empty one as null', () => {
    expect(
      answersOf({ wentWell: '  Viel geschafft ', wentBadly: '   ' }),
    ).toEqual({
      wentWell: 'Viel geschafft',
      wentBadly: null,
      changeNext: null,
    });
  });

  it('is null when every answer is empty, so no row is kept', () => {
    expect(answersOf({})).toBeNull();
    expect(
      answersOf({ wentWell: ' ', wentBadly: null, changeNext: '' }),
    ).toBeNull();
  });
});

describe('isActiveIn', () => {
  it('needs the campaign to exist by the end of the week', () => {
    expect(
      isActiveIn(
        todo(1, null, { createdAt: at('2026-11-22T20:00:00Z') }),
        RUNNING,
      ),
    ).toBe(true);
    // Monday 23 November, 00:30 in Berlin.
    expect(
      isActiveIn(
        todo(1, null, { createdAt: at('2026-11-22T23:30:00Z') }),
        RUNNING,
      ),
    ).toBe(false);
  });

  it('leaves out a campaign finished before the week, not one finished in it', () => {
    // Sunday 15 November, 23:30 in Berlin.
    expect(
      isActiveIn(todo(1, null, done('2026-11-15T22:30:00Z')), RUNNING),
    ).toBe(false);
    expect(
      isActiveIn(todo(1, null, done('2026-11-15T23:30:00Z')), RUNNING),
    ).toBe(true);
  });
});

describe('countsInWeek', () => {
  const goal = (periodStart: string, periodEnd: string) =>
    todo(1, null, { goalHabitId: 4, goalTarget: 20, periodStart, periodEnd });

  it('takes goals with a daily whose period touches the week', () => {
    expect(countsInWeek(goal('2026-11-22', '2026-12-31'), RUNNING)).toBe(true);
    expect(countsInWeek(goal('2026-10-01', '2026-11-16'), RUNNING)).toBe(true);
    expect(countsInWeek(goal('2026-10-01', '2026-11-15'), RUNNING)).toBe(false);
    expect(countsInWeek(todo(1, null), RUNNING)).toBe(false);
  });
});

describe('scopesAt', () => {
  it('counts what existed and what was done at that moment', () => {
    const scopes = scopesAt(
      [
        todo(1, null),
        todo(2, 1, done('2026-11-10T09:00:00Z')),
        todo(3, 1, done('2026-11-17T09:00:00Z')),
        todo(4, 1, { createdAt: at('2026-11-17T09:00:00Z') }),
        // Created later, but its parent is older: it belongs to campaign 1.
        todo(5, 4, { createdAt: at('2026-11-17T10:00:00Z') }),
      ],
      at('2026-11-15T23:00:00Z'),
    );
    expect(scopes.get(1)).toMatchObject({ doneCount: 1, totalCount: 3 });
  });

  it('counts a completed todo without a completion time as done', () => {
    const scopes = scopesAt(
      [todo(1, null, { completed: true, completedAt: null })],
      at('2026-11-15T23:00:00Z'),
    );
    expect(scopes.get(1)).toMatchObject({ doneCount: 1, totalCount: 1 });
  });
});

describe('campaignProgress', () => {
  const todos = [
    todo(1, null),
    todo(2, 1, done('2026-11-05T09:00:00Z')),
    todo(3, 1, done('2026-11-12T09:00:00Z')),
    todo(4, 1, done('2026-11-17T09:00:00Z')),
    todo(5, 1),
  ];
  const progress = (
    week: ReviewWeek,
    snapshots: SnapshotRow[] = [],
    list = todos,
  ) => campaignProgress([campaign], list, snapshots, [], new Map(), week);

  it('reads the running week back from the todos and ends with today', () => {
    const [row] = progress(RUNNING);
    expect(row.start).toEqual({
      doneCount: 2,
      totalCount: 5,
      percentage: 40,
      source: 'reconstructed',
    });
    expect(row.end).toEqual({
      doneCount: 3,
      totalCount: 5,
      percentage: 60,
      source: 'live',
    });
  });

  it('prefers the snapshot of the week before for the start', () => {
    const [row] = progress(RUNNING, [
      snapshot('2026-11-08', 0, 2),
      snapshot('2026-11-14', 1, 4),
      // Older than the week before: never used.
      snapshot('2026-11-01', 9, 9),
    ]);
    expect(row.start).toMatchObject({
      doneCount: 1,
      totalCount: 4,
      percentage: 25,
      source: 'snapshot',
    });
  });

  it('ends a past week with its latest snapshot, else reads it back', () => {
    expect(
      progress(PAST, [
        snapshot('2026-11-12', 2, 4),
        snapshot('2026-11-14', 2, 5),
      ])[0].end,
    ).toEqual({
      doneCount: 2,
      totalCount: 5,
      percentage: 40,
      source: 'snapshot',
    });
    // A snapshot after the week says nothing about its end.
    expect(progress(PAST, [snapshot('2026-11-16', 4, 5)])[0].end).toEqual({
      doneCount: 2,
      totalCount: 5,
      percentage: 40,
      source: 'reconstructed',
    });
  });

  it('shows the live state on both sides of a week still ahead', () => {
    const [row] = progress(AHEAD, [snapshot('2026-11-20', 0, 1)]);
    expect(row.start).toEqual(row.end);
    expect(row.start).toMatchObject({ doneCount: 3, source: 'live' });
  });

  it('starts a campaign created in the week at nothing', () => {
    const [row] = progress(
      RUNNING,
      [],
      [
        todo(1, null, { createdAt: at('2026-11-17T09:00:00Z') }),
        todo(2, 1, {
          createdAt: at('2026-11-17T09:00:00Z'),
          ...done('2026-11-18T09:00:00Z'),
        }),
      ],
    );
    expect(row.start).toMatchObject({
      doneCount: 0,
      totalCount: 0,
      percentage: 0,
    });
    expect(row.end).toMatchObject({
      doneCount: 1,
      totalCount: 2,
      percentage: 50,
    });
  });

  it('counts the runs of a daily goal in the campaign before and after the week', () => {
    const runs = [
      { habitId: 4, resolvedDate: '2026-11-02' },
      { habitId: 4, resolvedDate: '2026-11-15' },
      { habitId: 4, resolvedDate: '2026-11-17' },
      { habitId: 4, resolvedDate: '2026-11-18' },
      { habitId: 9, resolvedDate: '2026-11-18' },
    ];
    const [row] = campaignProgress(
      [campaign],
      [
        todo(1, null),
        todo(2, 1, {
          goalHabitId: 4,
          goalTarget: 20,
          periodStart: '2026-11-01',
          periodEnd: '2026-12-31',
        }),
        // Its period is over: not part of this week.
        todo(3, 1, {
          goalHabitId: 9,
          goalTarget: 5,
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
        }),
      ],
      [],
      runs,
      new Map([[4, 'Laufen']]),
      RUNNING,
    );
    expect(row.dailyGoals).toEqual([
      {
        todoId: 2,
        habitId: 4,
        habitTitle: 'Laufen',
        target: 20,
        before: 2,
        after: 4,
      },
    ]);
  });

  it('lists the campaigns that moved most first, then by title', () => {
    const rows = campaignProgress(
      [
        { id: 10, title: 'Zeichnen', color: null, icon: null },
        { id: 20, title: 'Album', color: null, icon: null },
        { id: 30, title: 'Garten', color: null, icon: null },
      ],
      [
        todo(10, null),
        todo(11, 10, done('2026-11-17T09:00:00Z')),
        todo(20, null),
        todo(30, null),
      ],
      [],
      [],
      new Map(),
      RUNNING,
    );
    expect(rows.map((row) => row.campaign.title)).toEqual([
      'Zeichnen',
      'Album',
      'Garten',
    ]);
  });
});

describe('doneDays', () => {
  const book = { id: 1, title: 'Buch', color: 'berry' as const, icon: null };
  const campaignOf = {
    todo: (id: number) => (id === 7 ? book : null),
    habit: (habitId: number) => (habitId === 4 ? book : null),
  };
  const run = (
    id: number,
    status: HabitOccurrenceStatus,
    dates: { scheduledDate: string; resolvedDate: string | null },
    resolvedAt: string | null = null,
  ) => ({
    id,
    habitId: 4,
    status,
    ...dates,
    resolvedAt: resolvedAt ? at(resolvedAt) : null,
    habit: { title: 'Laufen', deletedAt: null },
  });

  it('puts every item on its day in the order it happened', () => {
    const days = doneDays(
      RUNNING,
      [
        {
          id: 7,
          title: 'Kapitel',
          completedAt: at('2026-11-17T15:00:00Z'),
          deletedAt: null,
        },
        {
          id: 8,
          title: 'Altlast',
          // Sunday 22 November, 23:30 in Berlin.
          completedAt: at('2026-11-22T22:30:00Z'),
          deletedAt: at('2026-11-23T08:00:00Z'),
        },
      ],
      [
        run(
          1,
          HabitOccurrenceStatus.COMPLETED,
          { scheduledDate: '2026-11-16', resolvedDate: '2026-11-17' },
          '2026-11-17T07:00:00Z',
        ),
        // Skipped later, but it belongs to the day it was due.
        run(2, HabitOccurrenceStatus.SKIPPED, {
          scheduledDate: '2026-11-18',
          resolvedDate: '2026-11-19',
        }),
      ],
      campaignOf,
    );
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(days[1].items).toEqual([
      {
        type: 'habit',
        id: 1,
        title: 'Laufen',
        status: 'completed',
        resolvedAt: '2026-11-17T07:00:00.000Z',
        deleted: false,
        campaign: book,
      },
      {
        type: 'todo',
        id: 7,
        title: 'Kapitel',
        status: 'completed',
        resolvedAt: '2026-11-17T15:00:00.000Z',
        deleted: false,
        campaign: book,
      },
    ]);
    expect(days[2].items).toMatchObject([{ id: 2, status: 'skipped' }]);
    expect(days[6].items).toMatchObject([
      { id: 8, deleted: true, campaign: null },
    ]);
    expect(days[0].items).toEqual([]);
  });
});
