import {
  CorruptHierarchyError,
  HierarchyTodo,
  InvalidPlacementError,
  TodoTree,
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
const progress = (rows: HierarchyTodo[]) => TodoTree.of(rows).progress();

describe('TodoTree', () => {
  describe('progress', () => {
    it('handles empty and single todo', () => {
      expect(progress([]).size).toBe(0);
      expect(progress([t(1, null, true)]).get(1)?.percentage).toBe(100);
    });
    it('counts parent plus five children as six units', () => {
      const rows = [
        t(1, null, true),
        ...Array.from({ length: 5 }, (_, i) => t(i + 2, 1)),
      ];
      expect(progress(rows).get(1)).toMatchObject({
        total: 6,
        completed: 1,
        mode: 'count',
      });
    });
    it('weights all nodes including the parent by duration', () => {
      expect(
        progress([
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
        progress([t(1, null, true, 60), t(2, 1, true, 30), t(3, 1)]).get(1),
      ).toMatchObject({
        completed: 2,
        total: 3,
        knownDurationMinutes: 90,
        mode: 'count',
      });
    });
    it('counts intermediate nodes once', () => {
      const stats = progress([t(1, null), t(2, 1, true), t(3, 2, true)]);
      expect(stats.get(1)).toMatchObject({ completed: 2, total: 3 });
      expect(stats.get(2)).toMatchObject({ completed: 2, total: 2 });
    });
    it('treats an orphan as a root instead of failing the whole tree', () => {
      const stats = progress([t(1, null), t(2, 999, true)]);
      expect(stats.get(2)).toMatchObject({ completed: 1, total: 1 });
      expect(stats.get(1)).toMatchObject({ completed: 0, total: 1 });
    });
    it('processes 20,000 levels without recursion', () => {
      const rows = Array.from({ length: 20000 }, (_, i) =>
        t(i + 1, i === 0 ? null : i, true, 1),
      );
      expect(progress(rows).get(1)).toMatchObject({
        total: 20000,
        completed: 20000,
        percentage: 100,
      });
    });
  });

  it('reports stored cycles as corrupt data', () => {
    expect(() => TodoTree.of([t(1, 2), t(2, 1)])).toThrow(
      CorruptHierarchyError,
    );
    expect(() => TodoTree.of([t(1, null), t(2, 3), t(3, 2)])).toThrow(
      CorruptHierarchyError,
    );
  });

  it('returns a subtree in id order', () => {
    const tree = TodoTree.of([
      t(1, null),
      t(4, 1),
      t(2, 1),
      t(3, 2),
      t(5, null),
    ]);
    expect(tree.subtree(1).map((n) => n.id)).toEqual([1, 2, 3, 4]);
    expect(tree.subtree(2).map((n) => n.id)).toEqual([2, 3]);
    expect(tree.subtree(99)).toEqual([]);
  });

  describe('assertCanPlace (snapshot = parent ancestor chain)', () => {
    const chain = TodoTree.of([t(1, null), t(2, 1), t(3, 2)]);
    it('allows new and moved todos below a live parent', () => {
      expect(() => chain.assertCanPlace(null, 3)).not.toThrow();
      expect(() => chain.assertCanPlace(9, 3)).not.toThrow();
      expect(() => chain.assertCanPlace(9, null)).not.toThrow();
    });
    it('rejects placing a todo below itself or a descendant', () => {
      expect(() => chain.assertCanPlace(3, 3)).toThrow(InvalidPlacementError);
      expect(() => chain.assertCanPlace(1, 3)).toThrow(InvalidPlacementError);
    });
    it('rejects a missing or deleted parent', () => {
      expect(() => chain.assertCanPlace(null, 999)).toThrow(
        'Parent is unavailable',
      );
    });
    it('stops at a chain whose top lost its parent', () => {
      expect(() => TodoTree.of([t(5, 4)]).assertCanPlace(9, 5)).not.toThrow();
    });
    it('checks 20,000 levels without recursion', () => {
      const deep = TodoTree.of(
        Array.from({ length: 20000 }, (_, i) => t(i + 1, i === 0 ? null : i)),
      );
      expect(() => deep.assertCanPlace(1, 20000)).toThrow(
        InvalidPlacementError,
      );
    });
  });
});
