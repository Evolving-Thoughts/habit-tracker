import {
  HttpException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, LessThanOrEqual } from 'typeorm';
import { SessionEntity } from '../auth/auth.entities';
import { tokenHash } from '../auth/auth.crypto';
import { TimerEntity } from '../timers/timer.entity';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { TimersService } from '../timers/timers.service';
import { PushDeliveryEntity, PushSubscriptionEntity } from './push.entities';
import { SubscribeDto } from './push.dto';
import {
  DELIVERY_WINDOW_MS,
  PushTransport,
  validSubscription,
  type SendOptions,
} from './push.transport';
import { dayOf } from '../common/date/local-day';
import { DEFAULT_CARD_MINUTES } from '../day-bests/day-best.entities';
import { reminderDecision } from '../day-bests/day-best-rules';
import {
  loadReminderState,
  markReminded,
  reminderStillWanted,
} from '../day-bests/day-best-reminder';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import {
  challengeReminderDecision,
  monthOf,
} from '../month-challenges/challenge-rules';
import {
  challengeReminderTitle,
  loadChallengeReminder,
  markChallengeReminded,
} from '../month-challenges/challenge-reminder';

/** The longest a reminder may wait at the push provider, in seconds. */
const REMINDER_MAX_TTL_SECONDS = 3600;

/** What one delivery sends: its payload and how the provider should treat it. */
type Message = { payload: object; ttl: number; options?: SendOptions };

@Injectable()
export class PushService {
  constructor(
    private readonly db: DataSource,
    private readonly timers: TimersService,
    private readonly clock: Clock,
    private readonly transport: PushTransport,
    private readonly unitOfWork: UserUnitOfWork,
    private readonly scheduling: HabitSchedulingService,
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
  // Durable fan-out is separate from network delivery; restart/multiple workers use the same DB locks.
  async enqueueDue(): Promise<void> {
    const now = this.clock.now();
    const candidates = await this.db
      .getRepository(TimerEntity)
      .createQueryBuilder('t')
      .where('t.pushHandledAt IS NULL')
      .andWhere('(t.targetReachesAt <= :now OR t.targetReachedAt <= :now)', {
        now,
      })
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
        // Still on its way to the target: look again once it is due.
        if (timer && !timer.targetReachedAt) return;
        row.pushHandledAt = at;
        // Don't save the stale candidate object: reconciliation may have just changed or stopped it.
        await manager.update(TimerEntity, row.id, { pushHandledAt: at });
        if (!timer?.targetReachedAt) return;
        const expiresAt = new Date(
          timer.targetReachedAt.getTime() + DELIVERY_WINDOW_MS,
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
  /**
   * The evening reminder of "Das Beste des Tages": an hour after the card
   * time, for everyone with a push device whose day still has no line, at
   * most once a day (`remindedOn`). The rule is `reminderDecision`; a
   * reminder whose window passed unsent is marked handled, not caught up.
   */
  async enqueueDayBestReminders(): Promise<void> {
    const now = this.clock.now();
    const today = dayOf(now);
    // Cheap first pass without locks; the decision is taken again inside.
    const candidates = await this.db.query<
      {
        userId: string;
        cardMinutes: number | null;
        remindedOn: string | null;
      }[]
    >(
      `SELECT u.id AS "userId", s."cardMinutes",
              s."remindedOn"::text AS "remindedOn"
       FROM users u
       LEFT JOIN day_best_settings s ON s."userId" = u.id
       WHERE EXISTS (SELECT 1 FROM push_subscriptions p WHERE p."userId" = u.id)
         AND COALESCE(s."reminderEnabled", true)
         AND (s."remindedOn" IS NULL OR s."remindedOn" < $1)
         AND NOT EXISTS (
           SELECT 1 FROM day_bests b WHERE b."userId" = u.id AND b.date = $1
         )
       ORDER BY u.id`,
      [today],
    );
    for (const candidate of candidates) {
      const first = reminderDecision(now, {
        cardMinutes: candidate.cardMinutes ?? DEFAULT_CARD_MINUTES,
        reminderEnabled: true,
        remindedOn: candidate.remindedOn,
        hasEntry: false,
      });
      if (first.kind === 'none' || first.kind === 'wait') continue;
      await this.locked(candidate.userId, async (manager) => {
        const at = this.clock.now();
        const decision = reminderDecision(
          at,
          await loadReminderState(manager, candidate.userId, dayOf(at)),
        );
        if (decision.kind === 'none' || decision.kind === 'wait') return;
        await markReminded(manager, candidate.userId, decision.day);
        if (decision.kind === 'missed') return;
        for (const subscription of await this.subscriptions(
          manager,
          candidate.userId,
          at,
        ))
          await manager.save(
            PushDeliveryEntity,
            manager.create(PushDeliveryEntity, {
              userId: candidate.userId,
              kind: 'day-best',
              timerId: null,
              day: decision.day,
              subscriptionId: subscription.id,
              state: 'pending',
              attempts: 0,
              expiresAt: decision.expiresAt,
              retryAt: at,
            }),
          );
      });
    }
  }
  /**
   * The daily reminder of the Monats-Challenge: at the challenge's reminder
   * time, for everyone with a push device whose challenge runs today and
   * whose run of today is still open, at most once a day (`remindedOn`).
   * The rule is `challengeReminderDecision`; a reminder whose window passed
   * unsent, or whose run was already done, is marked handled.
   */
  async enqueueChallengeReminders(): Promise<void> {
    const now = this.clock.now();
    const today = dayOf(now);
    // Cheap first pass without locks; the decision is taken again inside.
    const candidates = await this.db.query<
      {
        userId: string;
        reminderMinutes: number;
        remindedOn: string | null;
      }[]
    >(
      `SELECT c."userId", c."reminderMinutes",
              c."remindedOn"::text AS "remindedOn"
       FROM month_challenges c
       WHERE c.month = $2
         AND c."startDate" <= $1
         AND c."endedAt" IS NULL
         AND c."habitId" IS NOT NULL
         AND c."reminderMinutes" IS NOT NULL
         AND (c."remindedOn" IS NULL OR c."remindedOn" < $1)
         AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p."userId" = c."userId")
       ORDER BY c.id`,
      [today, monthOf(today)],
    );
    for (const candidate of candidates) {
      const first = challengeReminderDecision(now, {
        reminderMinutes: candidate.reminderMinutes,
        remindedOn: candidate.remindedOn,
        running: true,
        runOpen: true,
      });
      if (first.kind === 'none' || first.kind === 'wait') continue;
      await this.locked(candidate.userId, async (manager) => {
        const at = this.clock.now();
        const reminder = await loadChallengeReminder(
          manager,
          this.scheduling,
          candidate.userId,
          at,
        );
        if (!reminder) return;
        const decision = challengeReminderDecision(at, reminder.state);
        if (decision.kind === 'none' || decision.kind === 'wait') return;
        await markChallengeReminded(
          manager,
          reminder.challengeId,
          decision.day,
        );
        if (decision.kind !== 'send') return;
        for (const subscription of await this.subscriptions(
          manager,
          candidate.userId,
          at,
        ))
          await manager.save(
            PushDeliveryEntity,
            manager.create(PushDeliveryEntity, {
              userId: candidate.userId,
              kind: 'challenge',
              timerId: null,
              day: decision.day,
              subscriptionId: subscription.id,
              state: 'pending',
              attempts: 0,
              expiresAt: decision.expiresAt,
              retryAt: at,
            }),
          );
      });
    }
  }
  /**
   * The message of a delivery, or null when it should no longer go out: the
   * stopwatch no longer stands at its Soll, the day got its line (or the
   * reminder was switched off), or the challenge's run of today was done in
   * the meantime.
   */
  private async message(
    manager: EntityManager,
    delivery: PushDeliveryEntity,
    subscriptionId: string,
    now: Date,
  ): Promise<Message | null> {
    const seconds = Math.ceil(
      (delivery.expiresAt.getTime() - now.getTime()) / 1000,
    );
    if (delivery.kind === 'day-best' || delivery.kind === 'challenge') {
      const wanted =
        !!delivery.day &&
        (delivery.kind === 'day-best'
          ? await reminderStillWanted(
              manager,
              delivery.userId,
              delivery.day,
              now,
            )
          : (await challengeReminderTitle(
              manager,
              delivery.userId,
              delivery.day,
              now,
            )) !== null);
      if (!wanted) return null;
      return {
        payload: {
          // The Daily's title is not part of it: the worker asks for it.
          type:
            delivery.kind === 'day-best'
              ? 'day-best-reminder'
              : 'challenge-reminder',
          deliveryId: delivery.id,
          subscriptionId,
          expiresAt: delivery.expiresAt.toISOString(),
        },
        ttl: Math.max(1, Math.min(REMINDER_MAX_TTL_SECONDS, seconds)),
        options: { urgency: 'normal' },
      };
    }
    if (!delivery.timerId) return null;
    const timer = await this.timers.notificationTimer(
      manager,
      delivery.userId,
      delivery.timerId,
      now,
    );
    if (!timer?.targetReachedAt) return null;
    return {
      payload: {
        type: 'timer-target-reached',
        timerId: timer.id,
        deliveryId: delivery.id,
        subscriptionId,
        expiresAt: delivery.expiresAt.toISOString(),
      },
      ttl: Math.max(1, Math.min(30, seconds)),
    };
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
        const message =
          subscription && delivery.expiresAt > now
            ? await this.message(manager, delivery, subscription.id, now)
            : null;
        if (!subscription || !message) {
          delivery.state = 'cancelled';
          await manager.save(delivery);
          return;
        }
        delivery.attempts += 1;
        // The bounded network request remains under the SAME user lock as timer transitions/logout.
        const target = {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        };
        // Timer messages keep their three-argument call (high urgency).
        const result = await (message.options
          ? this.transport.send(
              target,
              message.payload,
              message.ttl,
              message.options,
            )
          : this.transport.send(target, message.payload, message.ttl));
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
   * Whether the service worker may show a delivery it received. A challenge
   * reminder also gets the Daily's title here, behind the session, so the
   * push itself never carries it.
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
      if (delivery.kind === 'challenge') {
        const title = delivery.day
          ? await challengeReminderTitle(manager, userId, delivery.day, now)
          : null;
        return title === null ? { allowed: false } : { allowed: true, title };
      }
      if (delivery.kind === 'day-best')
        return {
          allowed:
            !!delivery.day &&
            (await reminderStillWanted(manager, userId, delivery.day, now)),
        };
      if (!delivery.timerId) return { allowed: false };
      const timer = await this.timers.notificationTimer(
        manager,
        userId,
        delivery.timerId,
        now,
      );
      return { allowed: !!timer?.targetReachedAt };
    });
  }
}
