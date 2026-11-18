import { countedRuns } from './habit-goal';

const goal = {
  goalHabitId: 7,
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
};
const run = (resolvedDate: string | null, habitId = 7) => ({
  habitId,
  resolvedDate,
});

describe('countedRuns', () => {
  const runs = [
    run('2026-10-31'),
    run('2026-11-01'),
    run('2026-11-15'),
    run('2026-11-16'),
    run('2026-11-30'),
    run('2026-12-01'),
    run('2026-11-10', 8),
    run(null),
  ];

  it('counts the runs of its daily done in the period', () => {
    expect(countedRuns(goal, runs)).toBe(4);
  });

  it('stops at `until` inside the period', () => {
    expect(countedRuns(goal, runs, '2026-11-15')).toBe(2);
    expect(countedRuns(goal, runs, '2026-10-31')).toBe(0);
  });

  it('never counts past the period, whatever `until` says', () => {
    expect(countedRuns(goal, runs, '2026-12-31')).toBe(4);
  });
});
