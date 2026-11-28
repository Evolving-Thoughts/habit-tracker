import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TodoEntity } from '../todos/entities/todo.entity';
import { resumeQuestWork } from '../todos/quest-commands';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { runRefusal } from '../habits/scheduling/run-actionability';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import { TimerEntity } from './timer.entity';
import { StartTimerDto } from './timer.dto';
import type { FocusBlockRequestDto } from '../focus-blocks/focus-block.dto';
import {
  findOpenTimer,
  isTodoTimerEligible,
  loggedMilliseconds,
  recordTransition,
  startFocusFor,
  stopTimer,
} from './timer-target';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { elapsedAt } from './timer-math';
import { startedStopwatch } from './timer-transition';
import { stopwatchCatchUp, type TargetAtHand } from './stopwatch-catch-up';

export interface TimerResponse {
  serverNow: string;
  /** The user's one running or paused stopwatch. */
  timer: null | {
    id: string;
    kind: 'todo' | 'occurrence';
    targetId: number;
    title: string;
    state: 'running' | 'paused';
    /** Time worked up to `serverNow`; a client counts on from there. */
    elapsedMilliseconds: number;
    /** Planned minutes of the target, if it has any. */
    targetMinutes: number | null;
    targetReachedAt: string | null;
  };
}

@Injectable()
export class TimersService {
  constructor(
    private readonly scheduling: HabitSchedulingService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}
  // Same per-user lock for every timer transition, across all devices/app processes.
  private transaction<T>(
    userId: string,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.unitOfWork.run(userId, operation);
  }
  private response(timer: TimerEntity | null, now: Date): TimerResponse {
    return {
      serverNow: now.toISOString(),
      timer:
        !timer || timer.state === 'stopped'
          ? null
          : {
              id: timer.id,
              kind: timer.todoId !== null ? 'todo' : 'occurrence',
              targetId: timer.todoId ?? timer.occurrenceId!,
              title: timer.title,
              state: timer.state,
              elapsedMilliseconds: elapsedAt(timer, now),
              targetMinutes: timer.targetMinutes,
              targetReachedAt: timer.targetReachedAt?.toISOString() ?? null,
            },
    };
  }
  private async target(
    manager: EntityManager,
    userId: string,
    kind: 'todo' | 'occurrence',
    id: number,
    now: Date,
  ): Promise<TodoEntity | HabitOccurrenceEntity> {
    if (kind === 'todo') {
      const todo = await manager.findOne(TodoEntity, {
        where: { id, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!todo) throw new NotFoundException('Quest nicht gefunden.');
      if (!isTodoTimerEligible(todo))
        throw new ConflictException('Erledigte Quests zuerst wieder öffnen.');
      return todo;
    }
    const { habit, occurrence, version } = await this.scheduling
      .openRun(manager, userId, id, now)
      .catch((error: unknown) => {
        if (error instanceof NotFoundException)
          throw new NotFoundException('Daily-Ausführung nicht gefunden.');
        throw error;
      });
    if (runRefusal({ run: occurrence, version, habit, now }) !== null)
      throw new ConflictException('Keine offene fällige Daily-Ausführung.');
    occurrence.habit = habit;
    return occurrence;
  }
  private targetOf(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity,
    now: Date,
  ): Promise<TodoEntity | HabitOccurrenceEntity> {
    return this.target(
      manager,
      userId,
      timer.todoId !== null ? 'todo' : 'occurrence',
      timer.todoId ?? timer.occurrenceId!,
      now,
    );
  }
  /**
   * The target as `stopwatchCatchUp` needs it, read under the lock the way
   * a start reads it: a Daily's runs are brought up to `now` first
   * (`openRun`), so a run that ran out is resolved and its stopwatch freed.
   */
  private async targetUnderLock(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity,
    now: Date,
  ): Promise<TargetAtHand> {
    try {
      const target = await this.targetOf(manager, userId, timer, now);
      return {
        eligible: true,
        title: target instanceof TodoEntity ? target.title : target.habit.title,
      };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      if (error instanceof ConflictException)
        return { eligible: false, title: timer.title };
      throw error;
    }
  }
  /**
   * The target as stored, for the lock-free read: nothing is brought up to
   * date. A run that only a reconcile would settle (ran out, other version)
   * counts as not eligible, so the read leaves it to the locked path.
   */
  private async targetAsStored(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity,
    now: Date,
  ): Promise<TargetAtHand> {
    if (timer.todoId !== null) {
      const todo = await manager.findOne(TodoEntity, {
        select: { id: true, title: true, completed: true },
        where: { id: timer.todoId, userId },
      });
      return todo
        ? { eligible: isTodoTimerEligible(todo), title: todo.title }
        : null;
    }
    const run = await ownedOccurrences(manager, userId, { select: true })
      .innerJoinAndSelect('occurrence.scheduleVersion', 'version')
      .andWhere('occurrence.id = :id', { id: timer.occurrenceId })
      .getOne();
    if (!run) return null;
    return {
      eligible:
        runRefusal({
          run,
          version: run.scheduleVersion,
          habit: run.habit,
          now,
        }) === null,
      title: run.habit.title,
    };
  }
  /**
   * Brings a stored stopwatch up to `now` under the user lock: decides with
   * `stopwatchCatchUp` on the target as it is now and stores the outcome.
   */
  private async reconcile(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity | null,
    now: Date,
  ): Promise<TimerEntity | null> {
    if (!timer || timer.state === 'stopped') return timer;
    const target = await this.targetUnderLock(manager, userId, timer, now);
    const decision = stopwatchCatchUp(timer, target, now);
    if (decision.outcome === 'keep') return timer;
    if (decision.outcome === 'stop')
      // Reading the target may have released this timer in the meantime.
      return stopTimer(
        manager,
        await manager.findOneByOrFail(TimerEntity, { id: timer.id }),
        now,
      );
    if (decision.title !== undefined) timer.title = decision.title;
    if (decision.reachedAt)
      await recordTransition(
        manager,
        timer,
        { type: 'reach' },
        decision.reachedAt,
      );
    if (decision.cutAt)
      await recordTransition(manager, timer, { type: 'pause' }, decision.cutAt);
    return manager.save(timer);
  }
  /**
   * The push worker looked at this stopwatch's reached Soll and does not
   * look again. Caller holds the user lock and passes the row as it is now.
   */
  async markPushHandled(
    manager: EntityManager,
    timer: TimerEntity,
    now: Date,
  ): Promise<void> {
    await recordTransition(manager, timer, { type: 'markPushHandled' }, now);
    await manager.save(TimerEntity, timer);
  }
  // Internal worker/receipt hook. Caller MUST hold the same user write lock as timer transitions.
  async notificationTimer(
    manager: EntityManager,
    userId: string,
    id: string,
    now: Date,
  ): Promise<TimerEntity | null> {
    const current = await findOpenTimer(manager, userId);
    if (current?.id !== id) return null;
    return this.reconcile(manager, userId, current, now);
  }
  /**
   * This stopwatch started or resumed running, from wherever: a
   * Fokus-Sperre starts with it when the rule calls for one
   * (`startFocusFor`). `request` carries Soft or Hardcore as picked in the
   * Fokus-Modus; without it the default from Einstellungen applies.
   */
  private async startFocus(
    manager: EntityManager,
    timer: TimerEntity,
    target: TodoEntity | HabitOccurrenceEntity,
    request: FocusBlockRequestDto | undefined,
    now: Date,
  ): Promise<void> {
    if (timer.state !== 'running') return;
    await startFocusFor(
      manager,
      timer,
      target instanceof TodoEntity
        ? target.focusBlock
        : target.habit.focusBlock,
      { mode: request?.mode },
      now,
    );
  }
  /** A quest worked on again leaves the board's "Geblockt" (`resumeQuestWork`). */
  private async workResumed(
    manager: EntityManager,
    target: TodoEntity | HabitOccurrenceEntity,
  ): Promise<void> {
    if (target instanceof TodoEntity) await resumeQuestWork(manager, target);
  }
  /**
   * The stopwatch as of now. Polled every few seconds, so it reads without
   * the user lock: when `stopwatchCatchUp` finds nothing to store, the
   * stored stopwatch is the answer. Otherwise it is read and decided again
   * under the lock, and the outcome stored there.
   */
  async current(userId: string): Promise<TimerResponse> {
    const asStored = await this.unitOfWork.read(async (manager) => {
      const timer = await findOpenTimer(manager, userId);
      // After the snapshot, as after the lock: nothing it shows lies ahead.
      const now = this.clock.now();
      if (!timer) return this.response(null, now);
      const target = await this.targetAsStored(manager, userId, timer, now);
      return stopwatchCatchUp(timer, target, now).outcome === 'keep'
        ? this.response(timer, now)
        : null;
    });
    if (asStored) return asStored;
    return this.transaction(userId, async (manager) => {
      const timer = await findOpenTimer(manager, userId);
      const now = this.clock.now();
      return this.response(
        await this.reconcile(manager, userId, timer, now),
        now,
      );
    });
  }
  private async persistDuration(
    manager: EntityManager,
    target: TodoEntity | HabitOccurrenceEntity,
    minutes: number,
  ): Promise<void> {
    target.plannedDurationMinutes = minutes;
    // Do not cascade-save or change the Habit identity/default.
    if (target instanceof TodoEntity) await manager.save(TodoEntity, target);
    else
      await manager.update(
        HabitOccurrenceEntity,
        { id: target.id },
        { plannedDurationMinutes: minutes },
      );
  }
  async start(userId: string, dto: StartTimerDto): Promise<TimerResponse> {
    return this.transaction(userId, async (manager) => {
      let now = this.clock.now();
      const active = await this.reconcile(
        manager,
        userId,
        await findOpenTimer(manager, userId),
        now,
      );
      const target = await this.target(
        manager,
        userId,
        dto.kind,
        dto.targetId,
        now,
      );
      await this.workResumed(manager, target);
      if (active && active.state !== 'stopped') {
        const same =
          (dto.kind === 'todo' ? active.todoId : active.occurrenceId) ===
          dto.targetId;
        if (same && !dto.replaceTimerId) {
          await this.startFocus(manager, active, target, dto.focusBlock, now);
          return this.response(active, now);
        }
        if (dto.replaceTimerId !== active.id)
          throw new ConflictException({
            message: 'Eine andere Stoppuhr läuft bereits.',
            code: 'ACTIVE_TIMER_EXISTS',
          });
        await stopTimer(manager, active, now);
      }
      const todoId = dto.kind === 'todo' ? dto.targetId : null;
      const occurrenceId = dto.kind === 'occurrence' ? dto.targetId : null;
      // A target worked on before counts on from what is logged for it.
      const logged = await loggedMilliseconds(
        manager,
        userId,
        todoId !== null ? { todoId } : { occurrenceId: occurrenceId! },
      );
      // The stretch starts only after every lock is held.
      now = this.clock.now();
      const timer = manager.create(TimerEntity, {
        userId,
        todoId,
        occurrenceId,
        title: target instanceof TodoEntity ? target.title : target.habit.title,
        ...startedStopwatch(
          logged,
          target instanceof HabitOccurrenceEntity
            ? effectiveDuration(target, target.habit)
            : target.plannedDurationMinutes,
          now,
        ),
      });
      const saved = await manager.save(TimerEntity, timer);
      await this.startFocus(manager, saved, target, dto.focusBlock, now);
      return this.response(saved, now);
    });
  }
  async action(
    userId: string,
    id: string,
    action: 'pause' | 'resume' | 'stop',
    focusBlock?: FocusBlockRequestDto,
  ): Promise<TimerResponse> {
    return this.transaction(userId, async (manager) => {
      const stored = await manager.findOneBy(TimerEntity, { id, userId });
      if (!stored) throw new NotFoundException('Stoppuhr nicht gefunden.');
      const now = this.clock.now();
      if (action === 'stop') {
        // Stopping what another device already stopped changes nothing.
        if (stored.state !== 'stopped') await stopTimer(manager, stored, now);
        return this.response(
          await this.reconcile(
            manager,
            userId,
            await findOpenTimer(manager, userId),
            now,
          ),
          now,
        );
      }
      const timer = await this.active(manager, userId, stored, now);
      if (action === 'pause' && timer.state === 'running')
        await recordTransition(manager, timer, { type: 'pause' }, now);
      else if (action === 'resume' && timer.state === 'paused')
        await recordTransition(manager, timer, { type: 'resume' }, now);
      const saved = await manager.save(timer);
      if (action === 'resume') {
        const target = await this.targetOf(manager, userId, saved, now);
        await this.workResumed(manager, target);
        await this.startFocus(manager, saved, target, focusBlock, now);
      }
      return this.response(saved, now);
    });
  }
  /**
   * Changes the planned minutes of the stopwatch's target. The time already
   * worked stays; only the moment the target is reached moves.
   */
  async setTarget(
    userId: string,
    id: string,
    minutes: number,
  ): Promise<TimerResponse> {
    return this.transaction(userId, async (manager) => {
      const stored = await manager.findOneBy(TimerEntity, { id, userId });
      if (!stored) throw new NotFoundException('Stoppuhr nicht gefunden.');
      const now = this.clock.now();
      const timer = await this.active(manager, userId, stored, now);
      await this.persistDuration(
        manager,
        await this.targetOf(manager, userId, timer, now),
        minutes,
      );
      await recordTransition(
        manager,
        timer,
        { type: 'changeTarget', minutes },
        now,
      );
      return this.response(await manager.save(timer), now);
    });
  }
  private async active(
    manager: EntityManager,
    userId: string,
    stored: TimerEntity,
    now: Date,
  ): Promise<TimerEntity> {
    const timer = await this.reconcile(manager, userId, stored, now);
    if (!timer || timer.state === 'stopped')
      throw new ConflictException('Die Stoppuhr läuft nicht mehr.');
    return timer;
  }
}
