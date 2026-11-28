import { dayOf } from '../common/date/local-day';
import { DEFAULT_CARD_MINUTES } from '../day-bests/day-best.entities';
import { reminderDecision } from '../day-bests/day-best-rules';
import {
  loadReminderState,
  markReminded,
  reminderStillWanted,
} from '../day-bests/day-best-reminder';
import type { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import {
  challengeReminderDecision,
  monthOf,
} from '../month-challenges/challenge-rules';
import {
  challengeReminderTitle,
  loadChallengeReminder,
  markChallengeReminded,
} from '../month-challenges/challenge-reminder';
import { TimerEntity } from '../timers/timer.entity';
import type { TimersService } from '../timers/timers.service';
import type { PushKind } from './push-kind';
import { DELIVERY_WINDOW_MS } from './push.transport';

/** The three kinds of push the app sends, by the `kind` of their rows. */
export type PushKinds = {
  timer: PushKind<TimerEntity>;
  'day-best': PushKind;
  challenge: PushKind;
};

/** The Nest token under which `PushService` gets the kinds. */
export const PUSH_KINDS = Symbol('PUSH_KINDS');

export function pushKinds(
  timers: TimersService,
  scheduling: HabitSchedulingService,
): PushKinds {
  return {
    timer: timerTargetKind(timers),
    'day-best': dayBestKind,
    challenge: challengeKind(scheduling),
  };
}

/** The longest a reminder may wait at the push provider, in seconds. */
const REMINDER_MAX_TTL_SECONDS = 3600;

/** A daily reminder is not handled while it is not due or not wanted at all. */
const handles = (decision: { kind: string }) =>
  decision.kind !== 'none' && decision.kind !== 'wait';

/**
 * A stopwatch reached its Soll. Each timer is looked at once
 * (`pushHandledAt`) as soon as it is due; a Soll reached more than the
 * delivery window ago (an offline server) is marked handled, not caught up.
 */
function timerTargetKind(timers: TimersService): PushKind<TimerEntity> {
  return {
    name: 'timer',
    maxTtlSeconds: DELIVERY_WINDOW_MS / 1000,
    candidates: (db, now) =>
      db
        .getRepository(TimerEntity)
        .createQueryBuilder('t')
        .where('t.pushHandledAt IS NULL')
        .andWhere('(t.targetReachesAt <= :now OR t.targetReachedAt <= :now)', {
          now,
        })
        .orderBy('t.createdAt', 'ASC')
        .take(100)
        .getMany(),
    async due(manager, candidate, now) {
      const row = await manager.findOneBy(TimerEntity, { id: candidate.id });
      if (!row || row.pushHandledAt) return null;
      const timer = await timers.notificationTimer(
        manager,
        candidate.userId,
        row.id,
        now,
      );
      // Still on its way to the target: look again once it is due.
      if (timer && !timer.targetReachedAt) return null;
      // Looked at once, whatever comes of it. Without a timer back the row
      // was not the open one, so reconciliation left it as it was read.
      await timers.markPushHandled(manager, timer ?? row, now);
      if (!timer?.targetReachedAt) return null;
      const expiresAt = new Date(
        timer.targetReachedAt.getTime() + DELIVERY_WINDOW_MS,
      );
      if (expiresAt <= now) return null; // No late catch-up notifications after an offline server.
      return { timerId: timer.id, day: null, expiresAt };
    },
    async stillWanted(manager, delivery, now) {
      if (!delivery.timerId) return null;
      const timer = await timers.notificationTimer(
        manager,
        delivery.userId,
        delivery.timerId,
        now,
      );
      return timer?.targetReachedAt ? {} : null;
    },
    payload: (delivery) => ({
      type: 'timer-target-reached',
      timerId: delivery.timerId,
    }),
  };
}

/**
 * The evening reminder of "Das Beste des Tages": an hour after the card
 * time, for everyone with a push device whose day still has no line, at
 * most once a day (`remindedOn`). The rule is `reminderDecision`; a
 * reminder whose window passed unsent is marked handled, not caught up.
 * It stops being wanted once the day got its line or the reminder was
 * switched off.
 */
const dayBestKind: PushKind = {
  name: 'day-best',
  maxTtlSeconds: REMINDER_MAX_TTL_SECONDS,
  options: { urgency: 'normal' },
  async candidates(db, now) {
    const rows = await db.query<
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
      [dayOf(now)],
    );
    return rows.filter((row) =>
      handles(
        reminderDecision(now, {
          cardMinutes: row.cardMinutes ?? DEFAULT_CARD_MINUTES,
          reminderEnabled: true,
          remindedOn: row.remindedOn,
          hasEntry: false,
        }),
      ),
    );
  },
  async due(manager, { userId }, now) {
    const decision = reminderDecision(
      now,
      await loadReminderState(manager, userId, dayOf(now)),
    );
    if (!handles(decision)) return null;
    await markReminded(manager, userId, decision.day);
    if (decision.kind !== 'send') return null;
    return { timerId: null, day: decision.day, expiresAt: decision.expiresAt };
  },
  async stillWanted(manager, delivery, now) {
    return delivery.day &&
      (await reminderStillWanted(manager, delivery.userId, delivery.day, now))
      ? {}
      : null;
  },
  payload: () => ({ type: 'day-best-reminder' }),
};

/**
 * The daily reminder of the Monats-Challenge: at the challenge's reminder
 * time, for everyone with a push device whose challenge runs today and
 * whose run of today is still open, at most once a day (`remindedOn`).
 * The rule is `challengeReminderDecision`; a reminder whose window passed
 * unsent, or whose run was already done, is marked handled. It stops being
 * wanted once today's run is done; while wanted, the confirm answer carries
 * the Daily's title, so the push itself never does.
 */
function challengeKind(scheduling: HabitSchedulingService): PushKind {
  return {
    name: 'challenge',
    maxTtlSeconds: REMINDER_MAX_TTL_SECONDS,
    options: { urgency: 'normal' },
    async candidates(db, now) {
      const today = dayOf(now);
      const rows = await db.query<
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
      return rows.filter((row) =>
        handles(
          challengeReminderDecision(now, {
            reminderMinutes: row.reminderMinutes,
            remindedOn: row.remindedOn,
            running: true,
            runOpen: true,
          }),
        ),
      );
    },
    async due(manager, { userId }, now) {
      const reminder = await loadChallengeReminder(
        manager,
        scheduling,
        userId,
        now,
      );
      if (!reminder) return null;
      const decision = challengeReminderDecision(now, reminder.state);
      if (!handles(decision)) return null;
      await markChallengeReminded(manager, reminder.challengeId, decision.day);
      if (decision.kind !== 'send') return null;
      return {
        timerId: null,
        day: decision.day,
        expiresAt: decision.expiresAt,
      };
    },
    async stillWanted(manager, delivery, now) {
      if (!delivery.day) return null;
      const title = await challengeReminderTitle(
        manager,
        delivery.userId,
        delivery.day,
        now,
      );
      return title === null ? null : { title };
    },
    // The Daily's title is not part of it: the worker asks for it.
    payload: () => ({ type: 'challenge-reminder' }),
  };
}
