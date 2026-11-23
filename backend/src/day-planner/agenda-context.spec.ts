import { categoryLabels } from '../categories/category-lookup';
import { TodoAncestry } from '../todos/todo-ancestry';
import { AgendaContext } from './agenda-context';

describe('AgendaContext', () => {
  const ancestry = {
    todoWhy: (todo: { why?: string | null }) => todo.why ?? 'geerbt',
    campaignOf: (todo: { id: number }) =>
      todo.id === 1 ? { id: 9, title: 'Buch', color: null, icon: null } : null,
    habitWhy: (habit: { why?: string | null }) => habit.why ?? 'vom Ziel',
    habitCampaign: (id: number) =>
      id === 5 ? { id: 9, title: 'Buch', color: null, icon: null } : null,
  } as unknown as TodoAncestry;
  const context = new AgendaContext(
    categoryLabels([{ id: 3, name: 'Arbeit', color: 'moss' }]),
    ancestry,
  );

  it('labels a quest with its category, reason and campaign', () => {
    expect(context.todo({ id: 1, categoryId: 3, why: null })).toEqual({
      categoryName: 'Arbeit',
      categoryColor: 'moss',
      why: 'geerbt',
      campaign: { id: 9, title: 'Buch', color: null, icon: null },
    });
  });

  it('labels a run through its habit, without a category when it has none', () => {
    expect(context.habit({ id: 5, categoryId: null, why: 'Gesund' })).toEqual({
      categoryName: null,
      categoryColor: null,
      why: 'Gesund',
      campaign: { id: 9, title: 'Buch', color: null, icon: null },
    });
  });
});
