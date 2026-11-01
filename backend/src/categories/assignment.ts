import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CategoryEntity } from './category.entity';

/**
 * Rules for assigning a category and a "why" to a todo or habit. Plain
 * functions, so todos and habits need no dependency on the categories module.
 */
export async function assertOwnedCategory(
  manager: EntityManager,
  userId: string,
  categoryId: number | null,
): Promise<void> {
  if (categoryId === null) return;
  const owned = await manager
    .getRepository(CategoryEntity)
    .existsBy({ id: categoryId, userId });
  if (!owned) throw new BadRequestException('Unknown category');
}

/** A blank reason is no reason. */
export function normalizeWhy(why: string | null | undefined): string | null {
  return why?.trim() || null;
}
