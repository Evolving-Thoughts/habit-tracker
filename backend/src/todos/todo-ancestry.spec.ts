import { TodoAncestry } from './todo-ancestry';

type Node = ConstructorParameters<typeof TodoAncestry>[0][number];

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
const sources = (nodes: Node[]) => new TodoAncestry(nodes, TODAY);

describe('TodoAncestry', () => {
  describe('reason of todos', () => {
    it('gives a top-level todo nothing to inherit', () => {
      const ancestry = sources([node(1, null, 'Gesund bleiben')]);
      expect(ancestry.inheritedWhy({ parentId: null })).toBeNull();
      expect(ancestry.todoWhy({ why: null, parentId: null })).toBeNull();
    });

    it('takes the reason of the direct parent', () => {
      const ancestry = sources([
        node(1, null, 'Gesund bleiben'),
        node(2, 1, null),
      ]);
      expect(ancestry.inheritedWhy({ parentId: 1 })).toEqual({
        text: 'Gesund bleiben',
        fromId: 1,
        fromTitle: 'Todo 1',
      });
    });

    it('skips ancestors without a reason and stops at the nearest one', () => {
      const ancestry = sources([
        node(1, null, 'Ganz oben'),
        node(2, 1, 'Mitte'),
        node(3, 2, null),
        node(4, 3, null),
      ]);
      expect(ancestry.inheritedWhy({ parentId: 3 })?.fromId).toBe(2);
      expect(ancestry.todoWhy({ why: null, parentId: 3 })).toBe('Mitte');
    });

    it('prefers the own reason but still reports what would be inherited', () => {
      const ancestry = sources([node(1, null, 'Oben'), node(2, 1, 'Eigenes')]);
      expect(ancestry.todoWhy({ why: 'Eigenes', parentId: 1 })).toBe('Eigenes');
      expect(ancestry.inheritedWhy({ parentId: 1 })?.text).toBe('Oben');
    });

    it('returns nothing when no ancestor has a reason or one is missing', () => {
      expect(
        sources([node(1, null, null), node(2, 1, null)]).inheritedWhy({
          parentId: 1,
        }),
      ).toBeNull();
      expect(sources([]).inheritedWhy({ parentId: 99 })).toBeNull();
    });

    it('ends on a cycle instead of looping', () => {
      const ancestry = sources([node(1, 2, null), node(2, 1, null)]);
      expect(ancestry.inheritedWhy({ parentId: 1 })).toBeNull();
    });
  });

  describe('reason of habits', () => {
    const period = { periodStart: '2026-11-01', periodEnd: '2026-12-31' };

    it('takes the reason of the goal counting the habit today', () => {
      const ancestry = sources([
        node(1, null, 'Halbmarathon schaffen', { goalHabitId: 7, ...period }),
      ]);
      expect(ancestry.inheritedHabitWhy(7)).toEqual({
        text: 'Halbmarathon schaffen',
        fromId: 1,
        fromTitle: 'Todo 1',
      });
      expect(ancestry.habitWhy({ id: 7, why: null })).toBe(
        'Halbmarathon schaffen',
      );
      expect(ancestry.habitWhy({ id: 7, why: 'Kopf frei' })).toBe('Kopf frei');
    });

    it('follows the goal up to an ancestor when the goal has no reason', () => {
      const ancestry = sources([
        node(1, null, 'Fit werden'),
        node(2, 1, null, { goalHabitId: 7, ...period }),
      ]);
      expect(ancestry.inheritedHabitWhy(7)?.fromId).toBe(1);
    });

    it('ignores goals outside their period and other habits', () => {
      const ancestry = sources([
        node(1, null, 'Vorbei', {
          goalHabitId: 7,
          periodStart: '2026-01-01',
          periodEnd: '2026-11-16',
        }),
        node(2, null, 'Anderes Habit', { goalHabitId: 8, ...period }),
      ]);
      expect(ancestry.inheritedHabitWhy(7)).toBeNull();
      expect(ancestry.habitWhy({ id: 7, why: null })).toBeNull();
    });
  });
  describe('campaign', () => {
    const at = (id: number, parentId: number | null) => ({
      id,
      parentId,
      title: `Todo ${id}`,
    });

    it('is the topmost todo above an entry', () => {
      const ancestry = sources([
        node(1, null, null),
        node(2, 1, null),
        node(3, 2, null),
      ]);
      expect(ancestry.campaignOf(at(3, 2))).toEqual({ id: 1, title: 'Todo 1' });
      expect(ancestry.campaignOf(at(2, 1))?.id).toBe(1);
    });

    it('makes a top-level todo its own campaign once it has todos below', () => {
      const ancestry = sources([
        node(1, null, null),
        node(2, 1, null),
        node(5, null, null),
      ]);
      expect(ancestry.campaignOf(at(1, null))?.id).toBe(1);
      expect(ancestry.campaignOf(at(5, null))).toBeNull();
    });

    it('stops where the chain leaves the snapshot or loops', () => {
      expect(sources([node(2, 9, null)]).campaignOf(at(3, 2))?.id).toBe(2);
      expect(sources([]).campaignOf(at(3, 2))).toBeNull();
      const looped = sources([node(1, 2, null), node(2, 1, null)]);
      expect(looped.campaignOf(at(1, 2))).not.toBeNull();
    });

    it('finds the campaign of a todo by its id, none for a deleted one', () => {
      const ancestry = sources([node(1, null, null), node(2, 1, null)]);
      expect(ancestry.todoCampaign(2)?.id).toBe(1);
      expect(ancestry.todoCampaign(1)?.id).toBe(1);
      expect(ancestry.todoCampaign(9)).toBeNull();
    });

    it('gives a habit the campaign of the goal counting it today', () => {
      const period = { periodStart: '2026-11-01', periodEnd: '2026-12-31' };
      const ancestry = sources([
        node(1, null, null),
        node(2, 1, null, { goalHabitId: 7, ...period }),
        node(3, null, null, { goalHabitId: 8, ...period }),
      ]);
      expect(ancestry.habitCampaign(7)?.id).toBe(1);
      // A lone goal still is what the habit works towards.
      expect(ancestry.habitCampaign(8)?.id).toBe(3);
      expect(ancestry.habitCampaign(9)).toBeNull();
    });
  });
});
