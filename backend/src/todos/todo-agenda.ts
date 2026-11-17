import { EntityManager, IsNull } from 'typeorm';
import { endOfDay, startOfDay } from '../common/date/local-day';
import { TodoEntity } from './entities/todo.entity';

/**
 * Todo agenda: the one definition of when a todo is planned, overdue,
 * completed on a day, or in the unscheduled backlog (the Questlog). Today,
 * history and the backlog all read through here, so they cannot disagree.
 *
 * A planned todo has its day. Only an appointment also has a time of day;
 * everything else is worked through in the order of its day.
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
  todo: { scheduledDate: string | null; completed: boolean },
  today: string,
): AgendaPlacement {
  if (!todo.scheduledDate) throw new Error('Expected a scheduled todo');
  const { scheduledDate } = todo;
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
    .andWhere('"todo"."scheduledDate" <= :lastDay', { lastDay: range.lastDay })
    .andWhere('("todo"."scheduledDate" >= :firstDay OR :overdue = true)', {
      firstDay: range.firstDay,
      overdue: range.includeOverdue,
    })
    .orderBy('"todo"."scheduledDate"', 'ASC')
    .addOrderBy('"todo"."dayPosition"', 'ASC', 'NULLS LAST')
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

/** Open todos without a day: the Questlog. */
export function backlogTodos(
  manager: EntityManager,
  userId: string,
): Promise<TodoEntity[]> {
  return manager.getRepository(TodoEntity).find({
    where: { userId, completed: false, scheduledDate: IsNull() },
    order: { id: 'ASC' },
  });
}
