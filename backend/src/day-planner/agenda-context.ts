import { EntityManager } from 'typeorm';
import { CategoryEntity } from '../categories/category.entity';
import { categoryLabels, CategoryLabel } from '../categories/category-lookup';
import {
  Campaign,
  loadTodoAncestry,
  TodoAncestry,
} from '../todos/todo-ancestry';

/**
 * What every agenda entry shows beside its own fields: its category (name
 * and colour), its effective reason and the campaign it works towards. Heute
 * (`DayPlannerService.getToday`) and the Kalender (`HistoryService`) both
 * label their quests and runs through here, so the same entry reads the
 * same in both.
 */
export type EntryContext = CategoryLabel & {
  why: string | null;
  campaign: Campaign | null;
};

export class AgendaContext {
  constructor(
    private readonly category: (id: number | null) => CategoryLabel,
    /** The todo tree as of the day the context was loaded for. */
    readonly ancestry: TodoAncestry,
  ) {}

  /** A quest: its category, its own or inherited reason, its campaign. */
  todo(todo: {
    id: number;
    parentId?: number | null;
    categoryId?: number | null;
    why?: string | null;
  }): EntryContext {
    return {
      ...this.category(todo.categoryId ?? null),
      why: this.ancestry.todoWhy(todo),
      campaign: this.ancestry.campaignOf(todo),
    };
  }

  /** A daily run: the category, reason and campaign of its habit. */
  habit(habit: {
    id: number;
    categoryId?: number | null;
    why?: string | null;
  }): EntryContext {
    return {
      ...this.category(habit.categoryId ?? null),
      why: this.ancestry.habitWhy(habit),
      campaign: this.ancestry.habitCampaign(habit.id),
    };
  }
}

/** Reads the user's categories and todo tree once for a whole agenda. */
export async function loadAgendaContext(
  manager: EntityManager,
  userId: string,
  today: string,
): Promise<AgendaContext> {
  const [categories, ancestry] = await Promise.all([
    manager.getRepository(CategoryEntity).findBy({ userId }),
    loadTodoAncestry(manager, userId, today),
  ]);
  return new AgendaContext(categoryLabels(categories), ancestry);
}
