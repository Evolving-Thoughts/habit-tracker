import { EntityManager } from 'typeorm';
import { TodoEntity } from './entities/todo.entity';

/**
 * Loads only the rows a hierarchy rule needs, via recursive queries on the
 * parent index, instead of every todo of the user. UNION (not UNION ALL)
 * makes both terminate even on corrupt cyclic data.
 */

/** `todoId` and all its live ancestors (empty if it is not a live owned todo). */
export function ancestorChain(
  manager: EntityManager,
  userId: string,
  todoId: number,
): Promise<TodoEntity[]> {
  return manager
    .getRepository(TodoEntity)
    .createQueryBuilder('todo')
    .where(
      `"todo"."id" IN (
        WITH RECURSIVE chain AS (
          SELECT "id", "parentId" FROM "todos"
          WHERE "id" = :todoId AND "userId" = :userId AND "deletedAt" IS NULL
          UNION
          SELECT t."id", t."parentId" FROM "todos" t
          JOIN chain c ON t."id" = c."parentId"
          WHERE t."userId" = :userId AND t."deletedAt" IS NULL
        ) SELECT "id" FROM chain)`,
      { todoId, userId },
    )
    .getMany();
}

/** `rootId` and all its live descendants, ordered by id. */
export function subtree(
  manager: EntityManager,
  userId: string,
  rootId: number,
): Promise<TodoEntity[]> {
  return manager
    .getRepository(TodoEntity)
    .createQueryBuilder('todo')
    .where(
      `"todo"."id" IN (
        WITH RECURSIVE sub AS (
          SELECT "id" FROM "todos"
          WHERE "id" = :rootId AND "userId" = :userId AND "deletedAt" IS NULL
          UNION
          SELECT t."id" FROM "todos" t
          JOIN sub s ON t."parentId" = s."id"
          WHERE t."userId" = :userId AND t."deletedAt" IS NULL
        ) SELECT "id" FROM sub)`,
      { rootId, userId },
    )
    .orderBy('"todo"."id"', 'ASC')
    .getMany();
}
