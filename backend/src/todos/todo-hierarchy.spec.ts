import {
  hierarchyProgress,
  validateParent,
  HierarchyTodo,
} from './todo-hierarchy';
const t = (
  id: number,
  parentId: number | null,
  completed = false,
  duration: number | null = null,
): HierarchyTodo => ({
  id,
  parentId,
  completed,
  plannedDurationMinutes: duration,
});
describe('Todo hierarchy pure rules', () => {
  it('handles empty and single Todo', () => {
    expect(hierarchyProgress([]).size).toBe(0);
    expect(hierarchyProgress([t(1, null, true)]).get(1)?.percentage).toBe(100);
  });
  it('counts parent plus five children as six units', () => {
    const rows = [
      t(1, null, true),
      ...Array.from({ length: 5 }, (_, i) => t(i + 2, 1)),
    ];
    expect(hierarchyProgress(rows).get(1)).toMatchObject({
      total: 6,
      completed: 1,
      mode: 'count',
    });
  });
  it('weights all nodes including parent by duration', () => {
    expect(
      hierarchyProgress([
        t(1, null, true, 60),
        t(2, 1, true, 30),
        t(3, 1, false, 90),
      ]).get(1),
    ).toMatchObject({
      completed: 90,
      total: 180,
      percentage: 50,
      mode: 'duration',
    });
  });
  it('switches to equal counts if any duration is missing', () => {
    expect(
      hierarchyProgress([t(1, null, true, 60), t(2, 1, true, 30), t(3, 1)]).get(
        1,
      ),
    ).toMatchObject({
      completed: 2,
      total: 3,
      knownDurationMinutes: 90,
      mode: 'count',
    });
  });
  it('counts intermediate nodes once', () => {
    const stats = hierarchyProgress([t(1, null), t(2, 1, true), t(3, 2, true)]);
    expect(stats.get(1)).toMatchObject({ completed: 2, total: 3 });
    expect(stats.get(2)).toMatchObject({ completed: 2, total: 2 });
  });
  it('detects cycles and missing parents', () => {
    expect(() => hierarchyProgress([t(1, 2), t(2, 1)])).toThrow();
    expect(() => hierarchyProgress([t(1, 999)])).toThrow();
  });
  it('validates root targets and rejects descendants', () => {
    const rows = [t(1, null), t(2, 1)];
    expect(() => validateParent(rows, 2, null)).not.toThrow();
    expect(() => validateParent(rows, 1, 2)).toThrow();
    expect(() => validateParent(rows, 1, 999)).toThrow();
  });
  it('processes 20,000 levels without recursive stack growth', () => {
    const rows = Array.from({ length: 20000 }, (_, i) =>
      t(i + 1, i === 0 ? null : i, true, 1),
    );
    expect(hierarchyProgress(rows).get(1)).toMatchObject({
      total: 20000,
      completed: 20000,
      percentage: 100,
    });
    expect(() => validateParent(rows, 1, 20000)).toThrow();
  });
});
