import { rootIds, scopesByRoot } from './goal-scope';

const todo = (
  id: number,
  parentId: number | null,
  completed = false,
  plannedDurationMinutes: number | null = null,
) => ({ id, parentId, completed, plannedDurationMinutes });

describe('scopesByRoot', () => {
  it('counts every level once under its root', () => {
    expect(
      scopesByRoot([
        todo(1, null, true, 60),
        todo(2, 1, false, 30),
        todo(3, 2, true),
        todo(4, null),
      ]),
    ).toEqual([
      {
        rootTodoId: 1,
        doneCount: 2,
        totalCount: 3,
        doneMinutes: 60,
        totalMinutes: 90,
      },
      {
        rootTodoId: 4,
        doneCount: 0,
        totalCount: 1,
        doneMinutes: 0,
        totalMinutes: 0,
      },
    ]);
  });

  it('leaves out what does not count, but keeps the tree through it', () => {
    // 2 does not count; 3 still belongs to root 1 through it.
    expect(
      scopesByRoot(
        [todo(1, null), todo(2, 1, true), todo(3, 2, true)],
        (item) => item.id !== 2,
      ),
    ).toEqual([
      {
        rootTodoId: 1,
        doneCount: 1,
        totalCount: 2,
        doneMinutes: 0,
        totalMinutes: 0,
      },
    ]);
  });

  it('handles very deep trees without recursion', () => {
    const deep = Array.from({ length: 20_000 }, (_, index) =>
      todo(index + 1, index === 0 ? null : index),
    );
    expect(scopesByRoot(deep)[0].totalCount).toBe(20_000);
  });
});

describe('rootIds', () => {
  it('finds the topmost todo, an orphan is its own root, a cycle stops', () => {
    expect(
      rootIds([
        { id: 1, parentId: null },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 2 },
        { id: 4, parentId: 99 },
        { id: 5, parentId: 6 },
        { id: 6, parentId: 5 },
      ]),
    ).toEqual(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 4],
        [5, 6],
        [6, 6],
      ]),
    );
  });
});
