import { scopesByRoot } from './goal-scope';

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

  it('handles very deep trees without recursion', () => {
    const deep = Array.from({ length: 20_000 }, (_, index) =>
      todo(index + 1, index === 0 ? null : index),
    );
    expect(scopesByRoot(deep)[0].totalCount).toBe(20_000);
  });
});
