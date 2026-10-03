import {
  HttpException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, LessThanOrEqual } from 'typeorm';
import { SessionEntity, UserEntity } from '../auth/auth.entities';
import { tokenHash } from '../auth/auth.crypto';
import { TimerEntity } from '../timers/timer.entity';
import { TimerClock } from '../timers/timer.clock';
import { TimersService } from '../timers/timers.service';
import { PushDeliveryEntity, PushSubscriptionEntity } from './push.entities';
import { SubscribeDto } from './push.dto';
import {
  DELIVERY_WINDOW_MS,
  PushTransport,
  validSubscription,
} from './push.transport';

@Injectable()
export class PushService {
  constructor(
    private readonly db: DataSource,
    private readonly timers: TimersService,
    private readonly clock: TimerClock,
    private readonly transport: PushTransport,
  ) {}
  config() {
    return {
      configured: !!this.transport.publicKey,
      publicKey: this.transport.publicKey,
    };
  }
  private async locked<T>(
    userId: string,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.db
      .transaction(async (manager) => {
        if (
          !(await manager.findOne(UserEntity, {
            where: { id: userId },
            lock: { mode: 'pessimistic_write' },
          }))
        )
          throw new NotFoundException();
        return operation(manager);
      })
      .catch((error: unknown) => {
        if (error instanceof HttpException) throw error;
        // SQL errors can contain endpoint/key parameters: never expose/log the original error.
        throw new ServiceUnavailableException('Push momentan nicht verfügbar.');
      });
  }
  private async session(
    manager: EntityManager,
    userId: string,
    hash: string,
    now: Date,
  ): Promise<void> {
    if (
      !(await manager.findOneBy(SessionEntity, {
        userId,
        hash,
        expiresAt: MoreThan(now),
      }))
    )
      throw new UnauthorizedException('Bitte erneut anmelden.');
  }
  async subscribe(userId: string, sessionHash: string, dto: SubscribeDto) {
    if (!this.transport.publicKey)
      throw new ServiceUnavailableException(
        'Push ist auf dem Server noch nicht eingerichtet.',
      );
    validSubscription(dto);
    return this.locked(userId, async (manager) => {
      await this.session(manager, userId, sessionHash, this.clock.now());
      await manager.query(
        'DELETE FROM push_subscriptions WHERE "userId" = $1 AND "sessionHash" IN (SELECT hash FROM auth_sessions WHERE "expiresAt" <= $2)',
        [userId, this.clock.now()],
      );
      const endpointHash = tokenHash(dto.endpoint);
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`push:${endpointHash}`],
      );
      let row = await manager.findOneBy(PushSubscriptionEntity, {
        endpointHash,
      });
      if (row && row.userId !== userId)
        throw new ConflictException(
          'Dieses Browser-Abonnement ist einem anderen Konto zugeordnet. Zuerst dort abmelden.',
        );
      if (
        !row &&
        (await manager.count(PushSubscriptionEntity, { where: { userId } })) >=
          20
      )
        throw new BadRequestException(
          'Maximal 20 Push-Geräte pro Konto. Bitte ein anderes Gerät deaktivieren.',
        );
      row ??= manager.create(PushSubscriptionEntity, { endpointHash, userId });
      // A fresh login is a new session: no pending delivery from the old session may transfer.
      if (row.id && row.sessionHash !== sessionHash)
        await manager.delete(PushDeliveryEntity, { subscriptionId: row.id });
      Object.assign(row, {
        sessionHash,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      });
      const saved = await manager.save(row);
      return { id: saved.id };
    });
  }
  async unsubscribe(userId: string, id: string): Promise<void> {
    await this.locked(userId, (manager) =>
      manager
        .delete(PushSubscriptionEntity, { id, userId })
        .then(() => undefined),
    );
  }
  private async subscriptions(
    manager: EntityManager,
    userId: string,
    now: Date,
  ) {
    return manager
      .getRepository(PushSubscriptionEntity)
      .createQueryBuilder('p')
      .innerJoin('p.session', 's')
      .where('p.userId = :userId', { userId })
      .andWhere('s.userId = :userId', { userId })
      .andWhere('s.expiresAt > :now', { now })
      .getMany();
  }
  // Durable fan-out is separate from network delivery; restart/multiple workers use the same DB locks.
  async enqueueDue(): Promise<void> {
    const now = this.clock.now();
    const candidates = await this.db
      .getRepository(TimerEntity)
      .createQueryBuilder('t')
      .where('t.pushHandledAt IS NULL')
      .andWhere(
        "((t.state = 'running' AND t.endsAt <= :now) OR (t.state = 'finished' AND t.finishedAt <= :now))",
        { now },
      )
      .orderBy('t.createdAt', 'ASC')
      .take(100)
      .getMany();
    for (const candidate of candidates)
      await this.locked(candidate.userId, async (manager) => {
        const row = await manager.findOneBy(TimerEntity, { id: candidate.id });
        if (!row || row.pushHandledAt) return;
        const at = this.clock.now();
        const timer = await this.timers.notificationTimer(
          manager,
          candidate.userId,
          row.id,
          at,
        );
        if (timer?.state === 'paused' || timer?.state === 'running') return;
        row.pushHandledAt = at;
        // Don't save the stale candidate object: reconciliation may have just finished/stopped it.
        await manager.update(TimerEntity, row.id, { pushHandledAt: at });
        if (timer?.state !== 'finished' || !timer.finishedAt) return;
        const expiresAt = new Date(
          timer.finishedAt.getTime() + DELIVERY_WINDOW_MS,
        );
        if (expiresAt <= at) return; // No late catch-up notifications after an offline server.
        for (const subscription of await this.subscriptions(
          manager,
          candidate.userId,
          at,
        )) {
          await manager.save(
            PushDeliveryEntity,
            manager.create(PushDeliveryEntity, {
              userId: candidate.userId,
              timerId: timer.id,
              subscriptionId: subscription.id,
              state: 'pending',
              attempts: 0,
              expiresAt,
              retryAt: at,
            }),
          );
        }
      });
  }
  async sendPending(): Promise<void> {
    const candidates = await this.db.getRepository(PushDeliveryEntity).find({
      where: { state: 'pending', retryAt: LessThanOrEqual(this.clock.now()) },
      order: { retryAt: 'ASC' },
      take: 100,
    });
    for (const candidate of candidates)
      await this.locked(candidate.userId, async (manager) => {
        const delivery = await manager.findOneBy(PushDeliveryEntity, {
          id: candidate.id,
        });
        if (!delivery || delivery.state !== 'pending') return;
        const now = this.clock.now();
        if (delivery.retryAt > now) return; // Another worker may just have deferred this row.
        const subscription = await manager
          .getRepository(PushSubscriptionEntity)
          .createQueryBuilder('p')
          .addSelect(['p.endpoint', 'p.p256dh', 'p.auth'])
          .innerJoin('p.session', 's')
          .where(
            'p.id = :id AND p.userId = :userId AND s.userId = :userId AND s.expiresAt > :now',
            { id: delivery.subscriptionId, userId: delivery.userId, now },
          )
          .getOne();
        const timer = await this.timers.notificationTimer(
          manager,
          delivery.userId,
          delivery.timerId,
          now,
        );
        if (
          !subscription ||
          timer?.state !== 'finished' ||
          delivery.expiresAt <= now
        ) {
          delivery.state = 'cancelled';
          await manager.save(delivery);
          return;
        }
        delivery.attempts += 1;
        // The bounded network request remains under the SAME user lock as timer transitions/logout.
        const result = await this.transport.send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          {
            type: 'timer-finished',
            timerId: timer.id,
            deliveryId: delivery.id,
            subscriptionId: subscription.id,
            expiresAt: delivery.expiresAt.toISOString(),
          },
          Math.max(
            1,
            Math.min(
              30,
              Math.ceil((delivery.expiresAt.getTime() - now.getTime()) / 1000),
            ),
          ),
        );
        if (result === 'gone') {
          await manager.delete(PushSubscriptionEntity, subscription.id);
          return;
        }
        if (result === 'sent') delivery.state = 'sent';
        else if (result === 'failed' || delivery.attempts >= 3)
          delivery.state = 'failed';
        else
          delivery.retryAt = new Date(
            this.clock.now().getTime() + 2000 * delivery.attempts,
          );
        await manager.save(delivery);
      });
  }
  async confirm(
    userId: string,
    sessionHash: string,
    id: string,
  ): Promise<{ allowed: boolean }> {
    return this.locked(userId, async (manager) => {
      const now = this.clock.now();
      await this.session(manager, userId, sessionHash, now);
      const delivery = await manager.findOneBy(PushDeliveryEntity, {
        id,
        userId,
      });
      if (
        !delivery ||
        !['pending', 'sent'].includes(delivery.state) ||
        delivery.expiresAt <= now
      )
        return { allowed: false };
      const subscription = await manager.findOneBy(PushSubscriptionEntity, {
        id: delivery.subscriptionId,
        userId,
        sessionHash,
      });
      if (!subscription) return { allowed: false };
      const timer = await this.timers.notificationTimer(
        manager,
        userId,
        delivery.timerId,
        now,
      );
      return { allowed: timer?.state === 'finished' };
    });
  }
}
