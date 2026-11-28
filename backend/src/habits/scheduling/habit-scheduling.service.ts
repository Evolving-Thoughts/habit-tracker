import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
} from 'typeorm';
import { HabitForecastPlaceEntity } from '../entities/habit-forecast-place.entity';
import {
  assertDateOnly,
  changeScheduleInstant,
} from '../../common/date/date-only.utils';
import { dayOf } from '../../common/date/local-day';
import { Clock } from '../../common/clock';
import { lockUser, UserUnitOfWork } from '../../common/user-unit-of-work';
import { ownedOccurrences } from '../../habit-occurrences/owned-occurrences';
import { hasOpenTimer, releaseTimers } from '../../timers/timer-target';
import { endFocusBlocksOfDone } from '../../focus-blocks/focus-block-store';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
} from '../../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { runRefusal } from './run-actionability';
import { ChangeHabitScheduleDto } from '../dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from '../dto/habit-response.dto';
import { HabitEntity } from '../entities/habit.entity';
import { loadTodoAncestry, TodoAncestry } from '../../todos/todo-ancestry';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import {
  buildVersion,
  isInMoveWindow,
  normalizeSchedule,
  ruleResponse,
  sameSchedule,
} from './schedule-rules';
import {
  activeVersion,
  isCompletedOn,
  lifecycleChanges,
} from './occurrence-lifecycle';
import { loadStreaks, NO_STREAK, Streak } from '../streaks';
import {
  challengeHabitIds,
  closeChallengesOfHabit,
} from '../../month-challenges/challenge-store';

/** A run opened for a change (`HabitSchedulingService.openRun`). */
export type OpenRun = {
  habit: HabitEntity;
  occurrence: HabitOccurrenceEntity;
  /** The run's own schedule version, for `runRefusal`. */
  version: HabitScheduleVersionEntity | undefined;
};

/**
 * Runs as of now. Callers ask three things and never reconcile or lock
 * themselves: a whole read answered as of now (`answerAsOfNow`, with
 * `todayRuns` and `getToday` for today's runs), a habit or run opened for a
 * change (`openHabit`, `editHabit`, `openRun`, inside the per-user unit of
 * work), and whether a run may be acted on (`runRefusal`, pure). The user
 * row is the one lock: every change here takes it first, so habit rows are
 * read without a lock of their own. The runs as of now are decided in a
 * lock-free read and stored under the lock only when something has to be
 * stored.
 */
@Injectable()
export class HabitSchedulingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** One of the user's habits, read after locking the user row. */
  private async ownedHabit(
    manager: EntityManager,
    userId: string,
    habitId: number,
  ): Promise<HabitEntity> {
    await lockUser(manager, userId);
    const habit = await manager
      .getRepository(HabitEntity)
      .findOneBy({ id: habitId, userId });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    return habit;
  }

  getVersions(
    manager: EntityManager,
    habitId: number,
  ): Promise<HabitScheduleVersionEntity[]> {
    return manager.getRepository(HabitScheduleVersionEntity).find({
      where: { habitId },
      order: { effectiveAt: 'ASC', id: 'ASC' },
    });
  }

  /** The series of one habit as of `now`. */
  async streakOf(
    manager: EntityManager,
    habitId: number,
    now: Date,
  ): Promise<Streak> {
    return (
      (await loadStreaks(manager, [habitId], now)).get(habitId) ?? NO_STREAK
    );
  }

  /** Whether the habit carries today's running Monats-Challenge (its marker). */
  async carriesChallenge(
    manager: EntityManager,
    userId: string,
    habitId: number,
    now: Date,
  ): Promise<boolean> {
    return (await challengeHabitIds(manager, userId, dayOf(now))).has(habitId);
  }

  versionResponse(
    version: HabitScheduleVersionEntity,
  ): ScheduleVersionResponse {
    return {
      id: version.id,
      effectiveFrom: dayOf(version.effectiveAt),
      effectiveAt: version.effectiveAt.toISOString(),
      endsAt: version.endsAt?.toISOString() ?? null,
      cancelledAt: version.cancelledAt?.toISOString() ?? null,
      firstDueDate: version.firstDueDate,
      schedule: ruleResponse(version),
    };
  }

  habitResponse(
    habit: HabitEntity,
    versions: HabitScheduleVersionEntity[],
    ancestry: TodoAncestry,
    at = this.clock.now(),
    pending?: HabitOccurrenceEntity,
    streak: Streak = NO_STREAK,
    monthChallenge = false,
  ): HabitResponseDto {
    const active = activeVersion(versions, at);

    const upcoming = versions.find(
      (version) => version.cancelledAt === null && version.effectiveAt > at,
    );

    return {
      id: habit.id,
      title: habit.title,
      categoryId: habit.categoryId ?? null,
      why: habit.why ?? null,
      campaignId: habit.campaignId ?? null,
      campaign: ancestry.habitCampaign(habit.id),
      inheritedWhy: ancestry.inheritedHabitWhy(habit.id),
      isActive: habit.isActive,
      plannedDurationMinutes: habit.plannedDurationMinutes,
      timeOfDay: habit.timeOfDay ?? null,
      focusBlock: habit.focusBlock ?? 'default',
      timerOccurrenceId: pending?.id ?? null,
      timerDurationMinutes: pending ? effectiveDuration(pending, habit) : null,
      currentSchedule: active ? this.versionResponse(active) : null,
      upcomingSchedule: upcoming ? this.versionResponse(upcoming) : null,
      streak,
      monthChallenge,
    };
  }

  async changeSchedule(
    userId: string,
    habitId: number,
    dto: ChangeHabitScheduleDto,
  ): Promise<HabitResponseDto> {
    const definition = normalizeSchedule(dto.schedule);

    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.ownedHabit(manager, userId, habitId);

      // Erst nach dem Lock bestimmen: parallele Änderungen erhalten
      // ihre tatsächliche Reihenfolge.
      const now = this.clock.now();
      const effectiveAt = changeScheduleInstant(dto.effectiveFrom, now);

      await this.reconcile(manager, habit, now);

      const versions = await this.getVersions(manager, habitId);
      const active = activeVersion(versions, now);

      const upcoming = versions.filter(
        (version) => version.cancelledAt === null && version.effectiveAt > now,
      );

      const identicalUpcoming = upcoming.find(
        (version) =>
          version.effectiveAt.getTime() === effectiveAt.getTime() &&
          sameSchedule(version, definition),
      );

      if (identicalUpcoming) {
        return this.habitResponse(
          habit,
          versions,
          await loadTodoAncestry(manager, userId, dayOf(now)),
          now,
          undefined,
          await this.streakOf(manager, habitId, now),
          await this.carriesChallenge(manager, userId, habitId, now),
        );
      }

      const repository = manager.getRepository(HabitScheduleVersionEntity);

      for (const version of upcoming) {
        version.cancelledAt = now;
        await repository.save(version);
      }

      const immediate = effectiveAt.getTime() === now.getTime();

      if (immediate && active && sameSchedule(active, definition)) {
        // Dieselbe aktuelle Regel: eine vorhandene Vormerkung
        // wird entfernt, ohne eine unnötige Version anzulegen.
        active.endsAt = null;
        await repository.save(active);
      } else {
        if (active) {
          active.endsAt = effectiveAt;
          await repository.save(active);
        }

        await repository.save(buildVersion(habitId, definition, effectiveAt));
      }

      await this.reconcile(manager, habit, now);

      return this.habitResponse(
        habit,
        await this.getVersions(manager, habitId),
        await loadTodoAncestry(manager, userId, dayOf(now)),
        now,
        undefined,
        await this.streakOf(manager, habitId, now),
        await this.carriesChallenge(manager, userId, habitId, now),
      );
    });
  }

  /**
   * Stores what has to change so the habit's runs match `now` (resolving
   * runs that ran out, creating due ones) and ends the stopwatch of every
   * run it resolves. Returns the habit's schedule versions it read. The
   * caller holds the user lock. `lifecycleChanges` walks every slot of
   * every version, so it needs all of the habit's runs, not a window.
   */
  private async reconcile(
    manager: EntityManager,
    habit: HabitEntity,
    now: Date,
    /** The habit's runs and versions when the caller read them for many habits at once. */
    loaded?: {
      occurrences: HabitOccurrenceEntity[];
      versions: HabitScheduleVersionEntity[];
    },
  ): Promise<HabitScheduleVersionEntity[]> {
    const repository = manager.getRepository(HabitOccurrenceEntity);
    const occurrences =
      loaded?.occurrences ??
      (await repository.find({
        where: { habitId: habit.id },
        order: { scheduledDate: 'ASC', id: 'ASC' },
      }));
    const versions =
      loaded?.versions ?? (await this.getVersions(manager, habit.id));
    const { resolve, create } = lifecycleChanges(
      habit,
      versions,
      occurrences,
      now,
    );

    for (const { occurrence, resolution } of resolve) {
      await repository.save(Object.assign(occurrence, resolution));
      // A resolved occurrence is no timer target any more.
      await releaseTimers(
        manager,
        habit.userId,
        { occurrenceIds: [occurrence.id] },
        now,
      );
    }
    // A run stored on its day takes the place it was sorted into while the
    // schedule only forecast it; places of days that have come go.
    const places = manager.getRepository(HabitForecastPlaceEntity);
    const waiting = create.length
      ? await places.findBy({ habitId: habit.id })
      : [];
    for (const occurrence of create)
      await repository.save(
        repository.create({
          habitId: habit.id,
          ...occurrence,
          dayPosition:
            waiting.find((place) => place.date === occurrence.scheduledDate)
              ?.dayPosition ?? null,
        }),
      );
    if (waiting.length)
      await places.delete({
        habitId: habit.id,
        date: LessThanOrEqual(dayOf(now)),
      });
    return versions;
  }

  /**
   * Opens one of the user's habits: takes the user lock and brings its runs
   * up to `now`. Returns the habit and its schedule versions. Throws
   * `NotFoundException` for a habit the user does not own.
   */
  async openHabit(
    manager: EntityManager,
    userId: string,
    habitId: number,
    now: Date,
  ): Promise<{ habit: HabitEntity; versions: HabitScheduleVersionEntity[] }> {
    const habit = await this.ownedHabit(manager, userId, habitId);
    const versions = await this.reconcile(manager, habit, now);
    return { habit, versions };
  }

  /**
   * Changes one of the user's habits: takes the user lock, lets `edit`
   * change the habit as it is stored, saves it, ends the stopwatch of its
   * runs when it is paused now, and only then brings its runs up to `now`
   * (so they follow the new state). Returns the habit and its versions.
   */
  async editHabit(
    manager: EntityManager,
    userId: string,
    habitId: number,
    now: Date,
    edit: (habit: HabitEntity) => Promise<void>,
  ): Promise<{ habit: HabitEntity; versions: HabitScheduleVersionEntity[] }> {
    const habit = await this.ownedHabit(manager, userId, habitId);
    await edit(habit);
    await manager.getRepository(HabitEntity).save(habit);
    if (!habit.isActive)
      await releaseTimers(manager, userId, { habitId: habit.id }, now);
    const versions = await this.reconcile(manager, habit, now);
    return { habit, versions };
  }

  /**
   * Deletes a habit (softly, its runs stay) and ends the stopwatch of its
   * runs. Its Monats-Challenges stay in the history under its title, with
   * their result frozen.
   */
  async removeHabit(
    manager: EntityManager,
    userId: string,
    habitId: number,
    now: Date,
  ): Promise<void> {
    const habit = await this.ownedHabit(manager, userId, habitId);
    await closeChallengesOfHabit(manager, habit, now);
    await manager.getRepository(HabitEntity).softRemove(habit);
    await releaseTimers(manager, userId, { habitId: habit.id }, now);
  }

  /**
   * Opens one of the user's runs for a change: takes the user lock, brings
   * its habit's runs up to `now` and reads the run as it is then, with its
   * habit and its own schedule version (ask `runRefusal` whether it may be
   * acted on). Throws `NotFoundException` for a run the user does not own.
   * Call it inside the per-user unit of work.
   */
  async openRun(
    manager: EntityManager,
    userId: string,
    id: number,
    now: Date,
  ): Promise<OpenRun> {
    const initial = await ownedOccurrences(manager, userId)
      .andWhere('occurrence.id = :id', { id })
      .getOne();
    if (!initial)
      throw new NotFoundException(
        `Habit occurrence with ID ${id} was not found`,
      );
    const { habit, versions } = await this.openHabit(
      manager,
      userId,
      initial.habitId,
      now,
    );
    const occurrence = await manager
      .getRepository(HabitOccurrenceEntity)
      .findOneByOrFail({ id });
    const version = versions.find(
      (item) => item.id === occurrence.scheduleVersionId,
    );
    return { habit, occurrence, version };
  }

  async changeStatus(
    userId: string,
    id: number,
    targetStatus: HabitOccurrenceStatus,
  ): Promise<HabitOccurrenceEntity> {
    return this.unitOfWork.run(userId, (manager) =>
      this.setRunStatus(manager, userId, id, targetStatus, this.clock.now()),
    );
  }

  /**
   * Completes, skips or reopens a run (`openRun` first). Only a run that may
   * be acted on (`runRefusal`, resolved runs included) can change;
   * resolving it ends its stopwatch, reopening needs it to be the habit's
   * only open or completed-today run. Positions in the day's order stay.
   */
  private async setRunStatus(
    manager: EntityManager,
    userId: string,
    id: number,
    targetStatus: HabitOccurrenceStatus,
    now: Date,
  ): Promise<HabitOccurrenceEntity> {
    if (
      ![
        HabitOccurrenceStatus.PENDING,
        HabitOccurrenceStatus.COMPLETED,
        HabitOccurrenceStatus.SKIPPED,
      ].includes(targetStatus)
    ) {
      throw new BadRequestException('Invalid manual status');
    }

    const { habit, occurrence, version } = await this.openRun(
      manager,
      userId,
      id,
      now,
    );
    const today = dayOf(now);
    const repository = manager.getRepository(HabitOccurrenceEntity);

    if (occurrence.status === targetStatus) {
      return occurrence;
    }

    if (occurrence.status === HabitOccurrenceStatus.CANCELLED) {
      throw new ConflictException('Cancelled occurrences cannot be changed');
    }

    if (
      runRefusal(
        { run: occurrence, version, habit, now },
        { resolved: true },
      ) !== null
    ) {
      throw new ConflictException('This occurrence is no longer actionable');
    }

    if (
      occurrence.status !== HabitOccurrenceStatus.PENDING &&
      targetStatus !== HabitOccurrenceStatus.PENDING
    ) {
      throw new ConflictException(
        'Reopen an occurrence before changing its resolved status',
      );
    }

    if (targetStatus === HabitOccurrenceStatus.PENDING) {
      const others = await repository.find({
        where: { habitId: habit.id },
      });

      if (
        others.some(
          (item) =>
            item.id !== occurrence.id &&
            (item.status === HabitOccurrenceStatus.PENDING ||
              isCompletedOn(item, today)),
        )
      ) {
        throw new ConflictException(
          'Another pending or completed-today occurrence exists',
        );
      }
    }

    occurrence.status = targetStatus;
    occurrence.resolvedDate =
      targetStatus === HabitOccurrenceStatus.PENDING ? null : today;
    occurrence.resolvedAt =
      targetStatus === HabitOccurrenceStatus.COMPLETED ? now : null;
    occurrence.cancellationReason = null;

    const saved = await repository.save(occurrence);
    // A resolved run is no stopwatch target any more; a done one also ends
    // its Fokus-Sperre, Hardcore included.
    if (targetStatus !== HabitOccurrenceStatus.PENDING)
      await releaseTimers(manager, userId, { occurrenceIds: [id] }, now);
    if (targetStatus === HabitOccurrenceStatus.COMPLETED)
      await endFocusBlocksOfDone(manager, userId, { occurrenceIds: [id] }, now);
    return saved;
  }

  /**
   * Moves a pending occurrence within its window. Only `movedToDate` changes:
   * the slot and with it the fixed schedule grid stay as they are.
   */
  async reschedule(
    userId: string,
    id: number,
    date: string,
  ): Promise<HabitOccurrenceEntity> {
    assertDateOnly(date);
    return this.unitOfWork.run(userId, (manager) =>
      this.moveRun(manager, userId, id, date, this.clock.now()),
    );
  }

  /**
   * Moves a run that may be acted on (`runRefusal`, one moved ahead
   * included) to `date` within its window (`openRun` first), never while a
   * stopwatch runs on it. Throws `ConflictException` when it may not move.
   * Its place in the day's order stays, as before.
   */
  async moveRun(
    manager: EntityManager,
    userId: string,
    id: number,
    date: string,
    now: Date,
  ): Promise<HabitOccurrenceEntity> {
    const { habit, occurrence, version } = await this.openRun(
      manager,
      userId,
      id,
      now,
    );

    if (
      !version ||
      runRefusal(
        { run: occurrence, version, habit, now },
        { movedAhead: true },
      ) !== null
    ) {
      throw new ConflictException(
        'Diese Ausführung kann nicht mehr verschoben werden.',
      );
    }

    if (!isInMoveWindow(version, occurrence.scheduledDate, date, dayOf(now))) {
      throw new ConflictException(
        'Der Tag liegt außerhalb des Terminfensters.',
      );
    }

    if (await hasOpenTimer(manager, userId, { occurrenceId: id })) {
      throw new ConflictException(
        'Beende zuerst die Stoppuhr, bevor du das Daily verschiebst.',
      );
    }

    occurrence.movedToDate = date === occurrence.scheduledDate ? null : date;

    return manager.getRepository(HabitOccurrenceEntity).save(occurrence);
  }

  async history(
    userId: string,
    habitId: number,
  ): Promise<HabitOccurrenceEntity[]> {
    const habit = await this.dataSource
      .getRepository(HabitEntity)
      .findOneBy({ id: habitId, userId });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    return this.dataSource.getRepository(HabitOccurrenceEntity).find({
      where: { habitId },
      order: { scheduledDate: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Today's runs of the user's active habits as of now: open ones due by
   * today, and those completed or skipped today. For a caller that needs
   * only the runs; a screen that reads more passes its whole read to
   * `answerAsOfNow` and asks `todayRuns` there.
   */
  getToday(userId: string): Promise<HabitOccurrenceEntity[]> {
    return this.answerAsOfNow(userId, (manager, now) =>
      this.todayRuns(manager, userId, now),
    );
  }

  /**
   * Answers a whole read as of now, from one snapshot with one `now`.
   * Decides in a lock-free consistent read whether any active habit has
   * runs to store (`lifecycleChanges`); in the common case it has none, and
   * `answer` reads in that same snapshot with that `now`, without the user
   * lock. Otherwise the runs are brought up to date under the lock (decided
   * again there) and `answer` reads in that same transaction, with a `now`
   * taken after the lock: a change that got the lock first happened before
   * it, and runs it created must not be judged by an earlier moment.
   * Nothing is stored from the lock-free decision. `answer` only reads, and
   * gets the same `manager` and `now` for all its reads.
   */
  async answerAsOfNow<T>(
    userId: string,
    answer: (manager: EntityManager, now: Date) => Promise<T>,
  ): Promise<T> {
    const now = this.clock.now();
    const asStored = await this.unitOfWork.read(async (manager) =>
      (await this.runsUpToDate(manager, userId, now))
        ? { value: await answer(manager, now) }
        : null,
    );
    if (asStored) return asStored.value;
    return this.unitOfWork.run(userId, async (manager) => {
      const lockedNow = this.clock.now();
      await this.reconcileActive(manager, userId, lockedNow);
      return answer(manager, lockedNow);
    });
  }

  /**
   * Whether the runs of the user's active habits (or of `habitIds` among
   * them) match `now` as stored: nothing to create, nothing ran out. Reads
   * only, so a lock-free read may ask it.
   */
  async runsUpToDate(
    manager: EntityManager,
    userId: string,
    now: Date,
    habitIds?: number[],
  ): Promise<boolean> {
    return (await this.loadActive(manager, userId, habitIds)).every(
      ({ habit, versions, occurrences }) => {
        const { resolve, create } = lifecycleChanges(
          habit,
          versions,
          occurrences,
          now,
        );
        return !resolve.length && !create.length;
      },
    );
  }

  private async reconcileActive(
    manager: EntityManager,
    userId: string,
    now: Date,
  ): Promise<void> {
    for (const loaded of await this.loadActive(manager, userId))
      await this.reconcile(manager, loaded.habit, now, loaded);
  }

  /**
   * The user's active habits (or `habitIds` among them) with all their runs
   * and schedule versions, as `reconcile` reads them for one habit. Three
   * reads for all habits: Heute, the Plan and the Daily list come through
   * here on every load.
   */
  private async loadActive(
    manager: EntityManager,
    userId: string,
    habitIds?: number[],
  ): Promise<
    {
      habit: HabitEntity;
      occurrences: HabitOccurrenceEntity[];
      versions: HabitScheduleVersionEntity[];
    }[]
  > {
    if (habitIds?.length === 0) return [];
    const habits = await manager.getRepository(HabitEntity).find({
      where: {
        isActive: true,
        userId,
        ...(habitIds ? { id: In(habitIds) } : {}),
      },
      order: { id: 'ASC' },
    });

    if (!habits.length) return [];
    const habitId = In(habits.map((habit) => habit.id));
    const [occurrences, versions] = await Promise.all([
      manager.getRepository(HabitOccurrenceEntity).find({
        where: { habitId },
        order: { scheduledDate: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(HabitScheduleVersionEntity).find({
        where: { habitId },
        order: { effectiveAt: 'ASC', id: 'ASC' },
      }),
    ]);
    const ofHabit = <Row extends { habitId: number }>(rows: Row[]) => {
      const groups = new Map<number, Row[]>();
      for (const row of rows) {
        const group = groups.get(row.habitId);
        if (group) group.push(row);
        else groups.set(row.habitId, [row]);
      }
      return groups;
    };
    const runs = ofHabit(occurrences);
    const plans = ofHabit(versions);
    return habits.map((habit) => ({
      habit,
      occurrences: runs.get(habit.id) ?? [],
      versions: plans.get(habit.id) ?? [],
    }));
  }

  /**
   * Today's runs of the user's active habits as stored, as of `now`: open
   * ones due by today, and those completed or skipped today, with habit
   * and schedule version. Reads only; ask it inside `answerAsOfNow`.
   */
  todayRuns(
    manager: EntityManager,
    userId: string,
    now: Date,
  ): Promise<HabitOccurrenceEntity[]> {
    const today = dayOf(now);

    return ownedOccurrences(manager, userId, { select: true })
      .innerJoinAndSelect('occurrence.scheduleVersion', 'version')
      .andWhere('"habit"."isActive" = true')
      .andWhere(
        new Brackets((query) => {
          query
            .where(
              `"occurrence"."status" = :pending
               AND COALESCE("occurrence"."movedToDate", "occurrence"."scheduledDate") <= :today`,
              {
                pending: HabitOccurrenceStatus.PENDING,
                today,
              },
            )
            .orWhere(
              `"occurrence"."status" = :completed
               AND "occurrence"."resolvedDate" = :today`,
              {
                completed: HabitOccurrenceStatus.COMPLETED,
                today,
              },
            )
            .orWhere(
              `"occurrence"."status" = :skipped
               AND "occurrence"."scheduledDate" = :today
               AND "occurrence"."resolvedDate" = :today`,
              {
                skipped: HabitOccurrenceStatus.SKIPPED,
                today,
              },
            );
        }),
      )
      .orderBy('"occurrence"."scheduledDate"', 'ASC')
      .addOrderBy('"occurrence"."id"', 'ASC')
      .getMany();
  }
}
