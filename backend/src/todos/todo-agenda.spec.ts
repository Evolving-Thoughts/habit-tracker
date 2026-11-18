import { workableBacklog } from './todo-agenda';

type Node = {
  id: number;
  parentId: number | null;
  completed: boolean;
  weeklyTargetMinutes: number | null;
  color: 'berry' | null;
  icon: 'book' | null;
};

const node = (
  id: number,
  parentId: number | null = null,
  fields: Partial<Node> = {},
): Node => ({
  id,
  parentId,
  completed: false,
  weeklyTargetMinutes: null,
  color: null,
  icon: null,
  ...fields,
});

const ids = (todos: Node[], live: Node[] = todos) =>
  workableBacklog(todos, live).map((todo) => todo.id);

describe('workableBacklog (the Questlog)', () => {
  it('keeps a loose quest and a step without quests below it', () => {
    const tree = [node(1), node(2), node(3, 2)];
    expect(ids([tree[0], tree[2]], tree)).toEqual([1, 3]);
  });

  it('leaves out a campaign with quests below it, open or done', () => {
    const open = [node(1), node(2, 1)];
    const done = [node(1), node(2, 1, { completed: true })];
    expect(ids([open[0]], open)).toEqual([]);
    expect(ids([done[0]], done)).toEqual([]);
  });

  it('leaves out a campaign made only by its colour, icon or weekly goal', () => {
    expect(
      ids([
        node(1, null, { color: 'berry' }),
        node(2, null, { icon: 'book' }),
        node(3, null, { weeklyTargetMinutes: 120 }),
        node(4),
      ]),
    ).toEqual([4]);
  });

  it('leaves out a Questreihe while a quest below it is open', () => {
    const tree = [
      node(1),
      node(2, 1),
      node(3, 2),
      node(4, 1),
      node(5, 4, { completed: true }),
    ];
    // 2 has an open quest below it; 4's quests are all done, so it is a step.
    expect(ids([tree[1], tree[2], tree[3]], tree)).toEqual([3, 4]);
  });
});
