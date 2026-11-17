import { EntityManager } from 'typeorm';
import { TodoEntity } from './entities/todo.entity';
import { InheritedWhy, inheritedWhy, WhyNode } from './todo-hierarchy';

type GoalNode = WhyNode & {
  goalHabitId: number | null;
  periodStart: string | null;
  periodEnd: string | null;
};

/**
 * Where a "why" is inherited from. A todo without its own reason takes the
 * one of its nearest ancestor that states one; a habit takes the one of the
 * goal that counts it today. Inheritance is live: nothing is copied, so a
 * changed reason reaches everything below it.
 */
export class WhySources {
  private readonly byId: Map<number, GoalNode>;

  constructor(
    nodes: GoalNode[],
    private readonly today: string,
  ) {
    this.byId = new Map(nodes.map((node) => [node.id, node]));
  }

  forTodo(todo: { parentId?: number | null }): InheritedWhy | null {
    return inheritedWhy(this.byId, todo.parentId);
  }

  forHabit(habitId: number): InheritedWhy | null {
    for (const goal of this.byId.values()) {
      if (
        goal.goalHabitId !== habitId ||
        goal.periodStart === null ||
        goal.periodEnd === null ||
        goal.periodStart > this.today ||
        goal.periodEnd < this.today
      )
        continue;
      return goal.why
        ? { text: goal.why, fromId: goal.id, fromTitle: goal.title }
        : this.forTodo(goal);
    }
    return null;
  }

  /** The reason to show for a todo: its own, else the inherited one. */
  todoWhy(todo: { why?: string | null; parentId?: number | null }) {
    return todo.why ?? this.forTodo(todo)?.text ?? null;
  }

  /** The reason to show for a habit: its own, else the inherited one. */
  habitWhy(habit: { id: number; why?: string | null }): string | null {
    return habit.why ?? this.forHabit(habit.id)?.text ?? null;
  }
}

/** One light read of the user's live todos; enough for every lookup. */
export async function loadWhySources(
  manager: EntityManager,
  userId: string,
  today: string,
): Promise<WhySources> {
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
  return new WhySources(nodes, today);
}
