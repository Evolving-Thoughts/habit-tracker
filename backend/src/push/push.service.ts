import {
  HttpException,
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, LessThanOrEqual } from 'typeorm';
import { SessionEntity } from '../auth/auth.entities';
import { tokenHash } from '../auth/auth.crypto';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { PushDeliveryEntity, PushSubscriptionEntity } from './push.entities';
import { SubscribeDto } from './push.dto';
import { PushTransport, validSubscription } from './push.transport';
import type { PushCandidate, PushKind } from './push-kind';
import { PUSH_KINDS, type PushKinds } from './push-kinds';

@Injectable()
export class PushService {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
    private readonly transport: PushTransport,
    private readonly unitOfWork: UserUnitOfWork,
    @Inject(PUSH_KINDS) private readonly kinds: PushKinds,
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
    return this.unitOfWork.run(userId, operation).catch((error: unknown) => {
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
  enqueueDue(): Promise<void> {
    return this.enqueue(this.kinds.timer);
  }
  enqueueDayBestReminders(): Promise<void> {
    return this.enqueue(this.kinds['day-best']);
  }
  enqueueChallengeReminders(): Promise<void> {
    return this.enqueue(this.kinds.challenge);
  }
  /**
   * Durable fan-out, separate from network delivery: each candidate of the
   * kind is decided again under its user's lock, and what is due is queued
   * once per live device. Restart/multiple workers use the same DB locks.
   */
  private async enqueue<C extends PushCandidate>(
    kind: PushKind<C>,
  ): Promise<void> {
    const candidates = await kind.candidates(this.db.manager, this.clock.now());
    for (const candidate of candidates)
      await this.locked(candidate.userId, async (manager) => {
        const at = this.clock.now();
        const due = await kind.due(manager, candidate, at);
        if (!due) return;
        for (const subscription of await this.subscriptions(
          manager,
          candidate.userId,
          at,
        ))
          await manager.save(
            PushDeliveryEntity,
            manager.create(PushDeliveryEntity, {
              ...due,
              userId: candidate.userId,
              kind: kind.name,
              subscriptionId: subscription.id,
              state: 'pending',
              attempts: 0,
              retryAt: at,
            }),
          );
      });
  }
  /**
   * Sends what is pending, one delivery at a time under its user's lock. A
   * delivery whose device, session or window is gone, or that its kind no
   * longer wants, is cancelled; a temporary failure is tried again after
   * 2 and 4 seconds, at most three attempts; a gone device is removed.
   */
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
        const kind = this.kinds[delivery.kind];
        const wanted =
          subscription &&
          delivery.expiresAt > now &&
          (await kind.stillWanted(manager, delivery, now));
        if (!subscription || !wanted) {
          delivery.state = 'cancelled';
          await manager.save(delivery);
          return;
        }
        delivery.attempts += 1;
        const payload = {
          ...kind.payload(delivery),
          deliveryId: delivery.id,
          subscriptionId: subscription.id,
          expiresAt: delivery.expiresAt.toISOString(),
        };
        const seconds = Math.ceil(
          (delivery.expiresAt.getTime() - now.getTime()) / 1000,
        );
        const ttl = Math.max(1, Math.min(kind.maxTtlSeconds, seconds));
        // The bounded network request remains under the SAME user lock as timer transitions/logout.
        const target = {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        };
        // A kind without options keeps the three-argument call (high urgency).
        const result = await (kind.options
          ? this.transport.send(target, payload, ttl, kind.options)
          : this.transport.send(target, payload, ttl));
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
  /**
   * Whether the service worker may show a delivery it received: it is live,
   * belongs to this session's device, and its kind still wants it. A
   * challenge reminder also gets the Daily's title here, behind the
   * session, so the push itself never carries it.
   */
  async confirm(
    userId: string,
    sessionHash: string,
    id: string,
  ): Promise<{ allowed: boolean; title?: string }> {
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
      const wanted = await this.kinds[delivery.kind].stillWanted(
        manager,
        delivery,
        now,
      );
      return wanted ? { allowed: true, ...wanted } : { allowed: false };
    });
  }
}
