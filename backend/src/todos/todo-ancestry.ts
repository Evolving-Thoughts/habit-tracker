import { EntityManager } from 'typeorm';
import { TodoEntity } from './entities/todo.entity';
import {
  InheritedWhy,
  inheritedWhy as inheritedWhyBelow,
  WhyNode,
} from './todo-hierarchy';

type AncestryNode = WhyNode & {
  goalHabitId: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

/** The campaign an entry works towards: the topmost todo above it. */
export type Campaign = { id: number; title: string };

/**
 * What a todo or habit takes from the todos above it, answered from one
 * snapshot of the user's live todos.
 *
 * - Reason: a todo without its own "why" takes the one of its nearest
 *   ancestor that states one; a habit takes the one of the goal that counts
 *   it today. Nothing is copied, so a changed reason reaches everything below.
 * - Campaign: the topmost ancestor. A top-level todo is its own campaign once
 *   it has todos below it; a habit belongs to the campaign of its goal.
 */
export class TodoAncestry {
  private readonly byId: Map<number, AncestryNode>;
  private readonly parents: Set<number>;

  constructor(
    nodes: AncestryNode[],
    private readonly today: string,
  ) {
    this.byId = new Map(nodes.map((node) => [node.id, node]));
    this.parents = new Set(
      nodes.flatMap((node) => (node.parentId == null ? [] : [node.parentId])),
    );
  }

  inheritedWhy(todo: { parentId?: number | null }): InheritedWhy | null {
    return inheritedWhyBelow(this.byId, todo.parentId);
  }

  inheritedHabitWhy(habitId: number): InheritedWhy | null {
    const goal = this.goalOf(habitId);
    if (!goal) return null;
    return goal.why
      ? { text: goal.why, fromId: goal.id, fromTitle: goal.title }
      : this.inheritedWhy(goal);
  }

  /** The reason to show for a todo: its own, else the inherited one. */
  todoWhy(todo: {
    why?: string | null;
    parentId?: number | null;
  }): string | null {
    return todo.why ?? this.inheritedWhy(todo)?.text ?? null;
  }

  /** The reason to show for a habit: its own, else the inherited one. */
  habitWhy(habit: { id: number; why?: string | null }): string | null {
    return habit.why ?? this.inheritedHabitWhy(habit.id)?.text ?? null;
  }

  campaignOf(todo: {
    id: number;
    title: string;
    parentId?: number | null;
  }): Campaign | null {
    if (todo.parentId == null)
      return this.parents.has(todo.id)
        ? { id: todo.id, title: todo.title }
        : null;
    const seen = new Set<number>([todo.id]);
    let top = this.byId.get(todo.parentId);
    while (top?.parentId != null && !seen.has(top.id)) {
      seen.add(top.id);
      const next = this.byId.get(top.parentId);
      if (!next) break; // The chain leaves the snapshot: this is the top.
      top = next;
    }
    return top ? { id: top.id, title: top.title } : null;
  }

  habitCampaign(habitId: number): Campaign | null {
    const goal = this.goalOf(habitId);
    if (!goal) return null;
    // Counting a habit makes even a lone goal something to work towards.
    return this.campaignOf(goal) ?? { id: goal.id, title: goal.title };
  }

  /** The todo whose habit goal counts `habitId` in a period covering today. */
  private goalOf(habitId: number): AncestryNode | undefined {
    for (const goal of this.byId.values())
      if (
        goal.goalHabitId === habitId &&
        goal.periodStart !== null &&
        goal.periodEnd !== null &&
        goal.periodStart <= this.today &&
        goal.periodEnd >= this.today
      )
        return goal;
    return undefined;
  }
}

/** One light read of the user's live todos; enough for every lookup. */
export async function loadTodoAncestry(
  manager: EntityManager,
  userId: string,
  today: string,
): Promise<TodoAncestry> {
  const nodes = await manager.getRepository(TodoEntity).find({
    select: {
      id: true,
      parentId: true,
      why: true,
      title: true,
      goalHabitId: true,
      periodStart: true,
      periodEnd: true,
    },
    where: { userId },
  });
  return new TodoAncestry(nodes, today);
}
