import type { HierarchyTodo } from "../types/todo-hierarchy";
import { hierarchyChildren, isCampaign } from "./todo-hierarchy";

/**
 * Where a quest can belong ("Gehört zu"): a campaign, or a quest anywhere
 * below one (a Questreihe or a single quest that gets quests below it).
 */
export type ParentChoice = {
  todo: HierarchyTodo;
  /** Titles from the campaign down to the choice, the choice last. */
  path: string[];
  /** The campaign at the top; the choice itself for a campaign. */
  campaign: HierarchyTodo;
};

/**
 * Every place a quest may move to, in the order of the Kampagnen tree.
 * `exclude` leaves out a quest and everything below it (it cannot go below
 * itself); done quests are left out, except `keep`, the current choice.
 * `campaignsOnly` lists just the campaigns (a daily belongs to one).
 */
export function parentChoices(
  todos: HierarchyTodo[],
  {
    exclude = null,
    keep = null,
    campaignsOnly = false,
  }: {
    exclude?: number | null;
    keep?: number | null;
    campaignsOnly?: boolean;
  } = {},
): ParentChoice[] {
  const groups = hierarchyChildren(todos);
  const parents = new Set<number | null>(todos.map((todo) => todo.parentId));
  const shown = (todo: HierarchyTodo) =>
    todo.id !== exclude && (!todo.completed || todo.id === keep);
  const choices: ParentChoice[] = [];
  const seen = new Set<number>();
  type Step = { todo: HierarchyTodo; path: string[]; top: HierarchyTodo };
  // Iterative, like visibleHierarchy: a deep chain must not overflow the stack.
  const stack: Step[] = (groups.get(null) ?? [])
    .filter((top) => isCampaign(top, parents) || top.id === keep)
    .reverse()
    .map((top) => ({ todo: top, path: [], top }));
  while (stack.length) {
    const { todo, path, top } = stack.pop()!;
    if (seen.has(todo.id) || !shown(todo)) continue;
    seen.add(todo.id);
    const here = [...path, todo.title];
    choices.push({ todo, path: here, campaign: top });
    if (!campaignsOnly)
      for (const child of (groups.get(todo.id) ?? []).slice().reverse())
        stack.push({ todo: child, path: here, top });
  }
  return choices;
}

/** The category a quest placed at `choice` starts with: its own, else the campaign's. */
export function categoryOfChoice(choice: ParentChoice): number | null {
  return choice.todo.categoryId ?? choice.campaign.categoryId ?? null;
}
