import { WhySources } from './why-sources';

type Node = ConstructorParameters<typeof WhySources>[0][number];

const node = (
  id: number,
  parentId: number | null,
  why: string | null,
  goal: Partial<Pick<Node, 'goalHabitId' | 'periodStart' | 'periodEnd'>> = {},
): Node => ({
  id,
  parentId,
  why,
  title: `Todo ${id}`,
  goalHabitId: null,
  periodStart: null,
  periodEnd: null,
  ...goal,
});

const TODAY = '2026-11-17';
const sources = (nodes: Node[]) => new WhySources(nodes, TODAY);

describe('WhySources', () => {
  describe('todos', () => {
    it('gives a top-level todo nothing to inherit', () => {
      const why = sources([node(1, null, 'Gesund bleiben')]);
      expect(why.forTodo({ parentId: null })).toBeNull();
      expect(why.todoWhy({ why: null, parentId: null })).toBeNull();
    });

    it('takes the reason of the direct parent', () => {
      const why = sources([node(1, null, 'Gesund bleiben'), node(2, 1, null)]);
      expect(why.forTodo({ parentId: 1 })).toEqual({
        text: 'Gesund bleiben',
        fromId: 1,
        fromTitle: 'Todo 1',
      });
    });

    it('skips ancestors without a reason and stops at the nearest one', () => {
      const why = sources([
        node(1, null, 'Ganz oben'),
        node(2, 1, 'Mitte'),
        node(3, 2, null),
        node(4, 3, null),
      ]);
      expect(why.forTodo({ parentId: 3 })?.fromId).toBe(2);
      expect(why.todoWhy({ why: null, parentId: 3 })).toBe('Mitte');
    });

    it('prefers the own reason but still reports what would be inherited', () => {
      const why = sources([node(1, null, 'Oben'), node(2, 1, 'Eigenes')]);
      expect(why.todoWhy({ why: 'Eigenes', parentId: 1 })).toBe('Eigenes');
      expect(why.forTodo({ parentId: 1 })?.text).toBe('Oben');
    });

    it('returns nothing when no ancestor has a reason or one is missing', () => {
      expect(
        sources([node(1, null, null), node(2, 1, null)]).forTodo({
          parentId: 1,
        }),
      ).toBeNull();
      expect(sources([]).forTodo({ parentId: 99 })).toBeNull();
    });

    it('ends on a cycle instead of looping', () => {
      const why = sources([node(1, 2, null), node(2, 1, null)]);
      expect(why.forTodo({ parentId: 1 })).toBeNull();
    });
  });

  describe('habits', () => {
    const period = { periodStart: '2026-11-01', periodEnd: '2026-12-31' };

    it('takes the reason of the goal counting the habit today', () => {
      const why = sources([
        node(1, null, 'Halbmarathon schaffen', { goalHabitId: 7, ...period }),
      ]);
      expect(why.forHabit(7)).toEqual({
        text: 'Halbmarathon schaffen',
        fromId: 1,
        fromTitle: 'Todo 1',
      });
      expect(why.habitWhy({ id: 7, why: null })).toBe('Halbmarathon schaffen');
      expect(why.habitWhy({ id: 7, why: 'Kopf frei' })).toBe('Kopf frei');
    });

    it('follows the goal up to an ancestor when the goal has no reason', () => {
      const why = sources([
        node(1, null, 'Fit werden'),
        node(2, 1, null, { goalHabitId: 7, ...period }),
      ]);
      expect(why.forHabit(7)?.fromId).toBe(1);
    });

    it('ignores goals outside their period and other habits', () => {
      const why = sources([
        node(1, null, 'Vorbei', {
          goalHabitId: 7,
          periodStart: '2026-01-01',
          periodEnd: '2026-11-16',
        }),
        node(2, null, 'Anderes Habit', { goalHabitId: 8, ...period }),
      ]);
      expect(why.forHabit(7)).toBeNull();
      expect(why.habitWhy({ id: 7, why: null })).toBeNull();
    });
  });
});
