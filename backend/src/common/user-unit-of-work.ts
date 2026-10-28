import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

/**
 * Locks the owning user row. Every write transaction that touches a user's
 * todos, habits, occurrences, timers or push devices takes this lock first,
 * so their transitions serialize per user in one fixed lock order:
 * user row → habit/todo rows. Re-locking inside the same transaction is a no-op.
 */
export async function lockUser(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  const user = await manager.findOne(UserEntity, {
    where: { id: userId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!user) throw new NotFoundException();
}

/** One transaction per user change, holding the per-user lock. */
@Injectable()
export class UserUnitOfWork {
  constructor(private readonly db: DataSource) {}

  run<T>(
    userId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (manager) => {
      await lockUser(manager, userId);
      return work(manager);
    });
  }
}
