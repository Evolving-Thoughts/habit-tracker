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

/**
 * The per-user transaction policy, with two intents:
 *
 * - `run`, a change: one transaction holding the user lock (`lockUser`), so
 *   every change of a user serializes behind the others. Every write takes it.
 * - `read`, a consistent read: one read-only `REPEATABLE READ` transaction
 *   without the lock, so everything it reads is one snapshot of committed
 *   state and it never waits for a change (nor a change for it).
 *
 * A read that finds something to store (a run that ran out, a stopwatch
 * forgotten overnight) never stores it from its snapshot: it answers "not
 * as is" and the caller decides again inside `run`.
 */
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

  read<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      return work(manager);
    });
  }
}
