import { EntityManager, IsNull } from 'typeorm';
import { dayOf, endOfDay, startOfDay } from '../common/date/local-day';
import { TodoEntity } from './entities/todo.entity';

/**
 * Todo agenda: the one definition of when a todo is planned, overdue,
 * completed on a day, or in the unscheduled backlog (Todo-Dump). Today,
 * history and the Dump all read through here, so they cannot disagree.
 */
export type AgendaPlacement = {
  /** Day the todo was scheduled for. */
  scheduledDate: string;
  /** Day it is shown on: overdue open todos move to today. */
  date: string;
  isOverdue: boolean;
};

/** Where an open scheduled todo appears relative to `today`. */
export function placeOpenTodo(
  todo: { scheduledAt: Date | null; completed: boolean },
  today: string,
): AgendaPlacement {
  if (!todo.scheduledAt) throw new Error('Expected a scheduled todo');
  const scheduledDate = dayOf(todo.scheduledAt);
  const isOverdue = !todo.completed && scheduledDate < today;
  return { scheduledDate, date: isOverdue ? today : scheduledDate, isOverdue };
}

/**
 * Open todos scheduled on `firstDay`..`lastDay`. With `includeOverdue`,
 * every open todo scheduled before `firstDay` is included as well.
 */
export function openScheduledTodos(
  manager: EntityManager,
  userId: string,
  range: { firstDay: string; lastDay: string; includeOverdue: boolean },
): Promise<TodoEntity[]> {
  return manager
    .getRepository(TodoEntity)
    .createQueryBuilder('todo')
    .where('"todo"."userId" = :userId', { userId })
    .andWhere('"todo"."completed" = false')
    .andWhere('"todo"."scheduledAt" < :end', { end: endOfDay(range.lastDay) })
    .andWhere('("todo"."scheduledAt" >= :start OR :overdue = true)', {
      start: startOfDay(range.firstDay),
      overdue: range.includeOverdue,
    })
    .orderBy('"todo"."scheduledAt"', 'ASC')
    .addOrderBy('"todo"."id"', 'ASC')
    .getMany();
}

/** Todos completed on `firstDay`..`lastDay` (optionally including deleted ones, for history). */
export function completedTodos(
  manager: EntityManager,
  userId: string,
  range: { firstDay: string; lastDay: string; withDeleted?: boolean },
): Promise<TodoEntity[]> {
  const query = manager.getRepository(TodoEntity).createQueryBuilder('todo');
  if (range.withDeleted) query.withDeleted();
  return query
    .where('"todo"."userId" = :userId', { userId })
    .andWhere('"todo"."completed" = true')
    .andWhere(
      '"todo"."completedAt" >= :start AND "todo"."completedAt" < :end',
      { start: startOfDay(range.firstDay), end: endOfDay(range.lastDay) },
    )
    .orderBy('"todo"."completedAt"', 'ASC')
    .addOrderBy('"todo"."id"', 'ASC')
    .getMany();
}

/** Open todos without a date: the Todo-Dump. */
export function backlogTodos(
  manager: EntityManager,
  userId: string,
): Promise<TodoEntity[]> {
  return manager.getRepository(TodoEntity).find({
    where: { userId, completed: false, scheduledAt: IsNull() },
    order: { id: 'ASC' },
  });
}
