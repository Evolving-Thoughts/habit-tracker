import { BadRequestException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { TodoEntity } from '../todos/entities/todo.entity';

/**
 * A daily may name the campaign it works towards: a live top-level todo of
 * the same user. Anything else is refused, so the daily never points at a
 * quest below a campaign or at someone else's todo.
 */
export async function assertCampaignTarget(
  manager: EntityManager,
  userId: string,
  campaignId: number | null,
): Promise<void> {
  if (campaignId === null) return;
  const exists = await manager
    .getRepository(TodoEntity)
    .existsBy({ id: campaignId, userId, parentId: IsNull() });
  if (!exists)
    throw new BadRequestException(
      'Ein Daily kann nur zu einer obersten Quest (Kampagne) gehören.',
    );
}
