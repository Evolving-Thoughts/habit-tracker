import { EntityManager, IsNull, Not } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
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
 *   ancestor that states one. A habit without one takes its campaign's
 *   (`habits.campaignId`), else the one of the goal that counts it today.
 *   Nothing is copied, so a changed reason reaches everything below.
 * - Campaign: the topmost ancestor. A top-level todo is its own campaign once
 *   it has todos below it or was given a weekly goal, colour or icon. A habit
 *   belongs to the campaign it names, else to the campaign of its goal; a
 *   named campaign that was deleted since counts as not named.
 */
export class TodoAncestry {
  private readonly byId: Map<number, AncestryNode>;
  private readonly parents: Set<number>;

  /**
   * `habitCampaigns` maps a habit to the todo it names as its campaign
   * (`habits.campaignId`); habits without one are left out.
   */
  constructor(
    nodes: AncestryNode[],
    private readonly today: string,
    private readonly habitCampaigns: ReadonlyMap<number, number> = new Map(),
  ) {
    this.byId = new Map(nodes.map((node) => [node.id, node]));
    this.parents = new Set(
      nodes.flatMap((node) => (node.parentId == null ? [] : [node.parentId])),
    );
  }

  inheritedWhy(todo: { parentId?: number | null }): InheritedWhy | null {
    return inheritedWhyBelow(this.byId, todo.parentId);
  }

  /** Own reason → named campaign's reason → the reason of the counting goal. */
  inheritedHabitWhy(habitId: number): InheritedWhy | null {
    const named = this.namedCampaignOf(habitId);
    const fromCampaign = named ? this.whyAt(named) : null;
    if (fromCampaign) return fromCampaign;
    const goal = this.goalOf(habitId);
    return goal ? this.whyAt(goal) : null;
  }

  /** The reason a todo states, else the one it inherits. */
  private whyAt(todo: AncestryNode): InheritedWhy | null {
    return todo.why
      ? { text: todo.why, fromId: todo.id, fromTitle: todo.title }
      : this.inheritedWhy(todo);
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

  /**
   * The campaign a habit works towards: the one it names, else the one of
   * the goal counting it today. Its measured time counts there.
   */
  habitCampaign(habitId: number): Campaign | null {
    const target = this.namedCampaignOf(habitId) ?? this.goalOf(habitId);
    if (!target) return null;
    // Naming or counting a habit makes even a lone todo something to work towards.
    return this.campaignOf(target) ?? campaign(target);
  }

  /** The live todo a habit names as its campaign. */
  private namedCampaignOf(habitId: number): AncestryNode | undefined {
    const id = this.habitCampaigns.get(habitId);
    return id === undefined ? undefined : this.byId.get(id);
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

/**
 * One light read of the user's live todos and of the campaigns their habits
 * name (deleted habits too: their logged time still counts somewhere).
 */
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
  const habits = await manager.getRepository(HabitEntity).find({
    select: { id: true, campaignId: true },
    where: { userId, campaignId: Not(IsNull()) },
    withDeleted: true,
  });
  return new TodoAncestry(
    nodes,
    today,
    new Map(habits.map((habit) => [habit.id, habit.campaignId!])),
  );
}
