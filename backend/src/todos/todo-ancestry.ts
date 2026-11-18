import { EntityManager } from 'typeorm';
import { CampaignFields, hasCampaignFields } from './campaign-style';
import { TodoEntity } from './entities/todo.entity';
import {
  InheritedWhy,
  inheritedWhy as inheritedWhyBelow,
  WhyNode,
} from './todo-hierarchy';

type AncestryNode = WhyNode &
  CampaignFields & {
    goalHabitId: number | null;
    periodStart: string | null;
    periodEnd: string | null;
  };

/** The campaign an entry works towards: the topmost todo above it. */
export type Campaign = Pick<AncestryNode, 'id' | 'title' | 'color' | 'icon'>;

const campaign = ({ id, title, color, icon }: AncestryNode): Campaign => ({
  id,
  title,
  color,
  icon,
});

/**
 * What a todo or habit takes from the todos above it, answered from one
 * snapshot of the user's live todos.
 *
 * - Reason: a todo without its own "why" takes the one of its nearest
 *   ancestor that states one; a habit takes the one of the goal that counts
 *   it today. Nothing is copied, so a changed reason reaches everything below.
 * - Campaign: the topmost ancestor. A top-level todo is its own campaign once
 *   it has todos below it or was given a weekly goal, colour or icon; a habit
 *   belongs to the campaign of its goal.
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

  campaignOf(todo: { id: number; parentId?: number | null }): Campaign | null {
    if (todo.parentId == null) {
      const own = this.byId.get(todo.id);
      return own && (this.parents.has(own.id) || hasCampaignFields(own))
        ? campaign(own)
        : null;
    }
    const seen = new Set<number>([todo.id]);
    let top = this.byId.get(todo.parentId);
    while (top?.parentId != null && !seen.has(top.id)) {
      seen.add(top.id);
      const next = this.byId.get(top.parentId);
      if (!next) break; // The chain leaves the snapshot: this is the top.
      top = next;
    }
    return top ? campaign(top) : null;
  }

  /** Every campaign with a weekly goal, and that goal. */
  campaignTargets(): { campaign: Campaign; minutes: number }[] {
    return [...this.byId.values()].flatMap((node) =>
      node.parentId == null && node.weeklyTargetMinutes !== null
        ? [{ campaign: campaign(node), minutes: node.weeklyTargetMinutes }]
        : [],
    );
  }

  /** The campaign of a todo known only by id; a deleted todo has none. */
  todoCampaign(todoId: number): Campaign | null {
    const todo = this.byId.get(todoId);
    return todo ? this.campaignOf(todo) : null;
  }

  habitCampaign(habitId: number): Campaign | null {
    const goal = this.goalOf(habitId);
    if (!goal) return null;
    // Counting a habit makes even a lone goal something to work towards.
    return this.campaignOf(goal) ?? campaign(goal);
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
      weeklyTargetMinutes: true,
      color: true,
      icon: true,
    },
    where: { userId },
  });
  return new TodoAncestry(nodes, today);
}
