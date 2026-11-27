import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Clock } from '../common/clock';
import { dayOf } from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { minutesOfTime } from '../day-bests/day-best-rules';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import {
  challengeResponse,
  countChallenge,
  freezeIfClosed,
} from './challenge-store';
import {
  assertChallengeMonth,
  challengeStatus,
  monthFromKey,
  monthOf,
  nextMonth,
  startDateFor,
} from './challenge-rules';
import type {
  MonthChallengeResponse,
  MonthChallengesResponse,
} from './month-challenge.dto';
import {
  DEFAULT_REMINDER_MINUTES,
  MonthChallengeEntity,
} from './month-challenge.entity';

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** "2026-11-01" → "November". */
function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}

/** The Monats-Challenges of a person: one Daily per calendar month. */
@Injectable()
export class MonthChallengesService {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
    private readonly scheduling: HabitSchedulingService,
  ) {}

  /**
   * This month's challenge with its progress, next month's and the earlier
   * ones, newest first. Closed results are frozen on the way; the running
   * challenge's Daily is brought up to now first, so today's run is there.
   */
  overview(userId: string): Promise<MonthChallengesResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const today = dayOf(now);
      const current = monthOf(today);
      const challenges = await manager
        .getRepository(MonthChallengeEntity)
        .find({
          where: { userId },
          relations: { habit: true },
          order: { month: 'DESC' },
        });
      const responses: MonthChallengeResponse[] = [];
      for (const challenge of challenges)
        responses.push(await this.respond(manager, userId, challenge, now));
      return {
        today,
        current:
          responses.find((item) => `${item.month}-01` === current) ?? null,
        next:
          responses.find((item) => `${item.month}-01` === nextMonth(current)) ??
          null,
        past: responses.filter((item) => `${item.month}-01` < current),
      };
    });
  }

  /** A Daily of one's own, still active, for this month or the next. */
  create(
    userId: string,
    input: { habitId: number; month: string; reminderTime?: string | null },
  ): Promise<MonthChallengeResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const today = dayOf(now);
      const month = monthFromKey(input.month);
      assertChallengeMonth(month, today);
      const habit = await manager
        .getRepository(HabitEntity)
        .findOneBy({ id: input.habitId, userId });
      if (!habit) throw new NotFoundException('Das Daily gibt es nicht.');
      if (!habit.isActive)
        throw new BadRequestException(
          'Ein pausiertes Daily kann keine Monats-Challenge tragen.',
        );
      const repository = manager.getRepository(MonthChallengeEntity);
      if (await repository.existsBy({ userId, month }))
        throw new ConflictException(
          `Für ${monthName(month)} gibt es schon eine Monats-Challenge.`,
        );
      const saved = await repository.save(
        repository.create({
          userId,
          habitId: habit.id,
          month,
          startDate: startDateFor(month, today),
          title: habit.title,
          reminderMinutes:
            input.reminderTime === undefined
              ? DEFAULT_REMINDER_MINUTES
              : input.reminderTime === null
                ? null
                : minutesOfTime(input.reminderTime),
          remindedOn: null,
          doneCount: null,
          dueCount: null,
          endedAt: null,
        }),
      );
      saved.habit = habit;
      return this.respond(manager, userId, saved, now);
    });
  }

  /** Changes the reminder of a challenge still to come or running. */
  update(
    userId: string,
    id: number,
    reminderTime: string | null,
  ): Promise<MonthChallengeResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const challenge = await this.open(manager, userId, id, now);
      challenge.reminderMinutes =
        reminderTime === null ? null : minutesOfTime(reminderTime);
      await manager.update(MonthChallengeEntity, challenge.id, {
        reminderMinutes: challenge.reminderMinutes,
      });
      return this.respond(manager, userId, challenge, now);
    });
  }

  /**
   * Ends the running challenge today: it stays in the history with what
   * was decided by now; a run still open today counts neither way.
   */
  end(userId: string, id: number): Promise<MonthChallengeResponse> {
    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();
      const challenge = await this.open(manager, userId, id, now);
      if (challengeStatus(challenge, dayOf(now)) !== 'running')
        throw new ConflictException(
          'Nur eine laufende Monats-Challenge lässt sich beenden.',
        );
      // What was decided by now, with runs that ran out resolved.
      if (challenge.habitId !== null)
        await this.scheduling.openHabit(
          manager,
          userId,
          challenge.habitId,
          now,
        );
      challenge.endedAt = now;
      await manager.update(MonthChallengeEntity, challenge.id, {
        endedAt: now,
      });
      await freezeIfClosed(manager, challenge, now);
      return this.respond(manager, userId, challenge, now);
    });
  }

  /** Removes a challenge, whatever its state; one not there is fine. */
  async remove(userId: string, id: number): Promise<void> {
    await this.unitOfWork.run(userId, (manager) =>
      manager.getRepository(MonthChallengeEntity).delete({ id, userId }),
    );
  }

  /** One's own challenge that is not closed yet. */
  private async open(
    manager: EntityManager,
    userId: string,
    id: number,
    now: Date,
  ): Promise<MonthChallengeEntity> {
    const challenge = await manager
      .getRepository(MonthChallengeEntity)
      .findOne({
        where: { id, userId },
        relations: { habit: true },
      });
    if (!challenge)
      throw new NotFoundException('Die Monats-Challenge gibt es nicht.');
    const status = challengeStatus(challenge, dayOf(now));
    if (status !== 'running' && status !== 'upcoming')
      throw new ConflictException(
        'Eine abgeschlossene Monats-Challenge lässt sich nicht mehr ändern.',
      );
    return challenge;
  }

  /** The response, frozen once closed, counted (Daily brought up to now) while it runs. */
  private async respond(
    manager: EntityManager,
    userId: string,
    challenge: MonthChallengeEntity,
    now: Date,
  ): Promise<MonthChallengeResponse> {
    const today = dayOf(now);
    await freezeIfClosed(manager, challenge, now);
    const status = challengeStatus(challenge, today);
    if (status === 'upcoming')
      // Nothing stored yet: the Daily's rhythm says what will be due.
      return challengeResponse(
        challenge,
        today,
        await countChallenge(manager, challenge, now),
      );
    if (status !== 'running') return challengeResponse(challenge, today);
    if (challenge.habit?.isActive)
      await this.scheduling.openHabit(manager, userId, challenge.habit.id, now);
    return challengeResponse(
      challenge,
      today,
      await countChallenge(manager, challenge, now),
    );
  }
}
