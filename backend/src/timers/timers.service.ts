import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { TodoEntity } from '../todos/entities/todo.entity';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { dayOf } from '../common/date/local-day';
import { TimerEntity } from './timer.entity';
import { StartTimerDto } from './timer.dto';
import type { FocusBlockRequestDto } from '../focus-blocks/focus-block.dto';
import { startFocusBlock } from '../focus-blocks/focus-block-store';
import {
  isOccurrenceTimerEligible,
  isTodoTimerEligible,
  loggedMilliseconds,
  recordTransition,
  stopTimer,
} from './timer-target';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  elapsedAt,
  forgottenSince,
  hasReachedTarget,
  targetReachesAt,
} from './timer-math';

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
    const { habit, occurrence } = await this.scheduling
      .openRun(manager, userId, id, now)
      .catch((error: unknown) => {
        if (error instanceof NotFoundException)
          throw new NotFoundException('Daily-Ausführung nicht gefunden.');
        throw error;
      });
    if (!isOccurrenceTimerEligible(occurrence, habit, dayOf(now)))
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
  /** Ends the running stretch at `at` and leaves the stopwatch paused. */
  private async pause(
    manager: EntityManager,
    timer: TimerEntity,
    at: Date,
  ): Promise<void> {
    await recordTransition(manager, timer, 'pause', at);
    timer.targetReachesAt = null;
  }
  /**
   * Brings a stored stopwatch up to `now`: stops it if its target is gone,
   * marks a target that was reached meanwhile, and cuts a stretch nobody ended.
   */
  private async reconcile(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity | null,
    now: Date,
  ): Promise<TimerEntity | null> {
    if (!timer || timer.state === 'stopped') return timer;
    let changed = false;
    try {
      const target = await this.targetOf(manager, userId, timer, now);
      const title =
        target instanceof TodoEntity ? target.title : target.habit.title;
      if (title !== timer.title) {
        timer.title = title;
        changed = true;
      }
    } catch (error) {
      if (!(
        error instanceof NotFoundException || error instanceof ConflictException
      ))
        throw error;
      // Reconciling the target may have released this timer in the meantime.
      return stopTimer(
        manager,
        await manager.findOneByOrFail(TimerEntity, { id: timer.id }),
        now,
      );
    }
    const cut = forgottenSince(timer, now);
    if (timer.targetReachesAt && timer.targetReachesAt <= (cut ?? now)) {
      timer.targetReachedAt = timer.targetReachesAt;
      timer.targetReachesAt = null;
      changed = true;
    }
    if (cut) {
      await this.pause(manager, timer, cut);
      changed = true;
    }
    return changed ? manager.save(timer) : timer;
  }
  private findCurrent(
    manager: EntityManager,
    userId: string,
  ): Promise<TimerEntity | null> {
    return manager.findOne(TimerEntity, {
      where: { userId, state: In(['running', 'paused']) },
    });
  }
  // Internal worker/receipt hook. Caller MUST hold the same user write lock as timer transitions.
  async notificationTimer(
    manager: EntityManager,
    userId: string,
    id: string,
    now: Date,
  ): Promise<TimerEntity | null> {
    const current = await this.findCurrent(manager, userId);
    if (current?.id !== id) return null;
    return this.reconcile(manager, userId, current, now);
  }
  /**
   * The Fokus-Modus started or resumed this stopwatch: a Fokus-Sperre
   * starts with it when its quest or daily calls for one (an open block
   * stays as it is). Runs in the stopwatch's own transaction.
   */
  private async startFocus(
    manager: EntityManager,
    timer: TimerEntity,
    target: TodoEntity | HabitOccurrenceEntity,
    request: FocusBlockRequestDto | undefined,
    now: Date,
  ): Promise<void> {
    if (!request) return;
    await startFocusBlock(
      manager,
      timer.userId,
      {
        target:
          timer.todoId !== null
            ? { todoId: timer.todoId }
            : { occurrenceId: timer.occurrenceId! },
        title: timer.title,
        override:
          (target instanceof TodoEntity
            ? target.focusBlock
            : target.habit.focusBlock) ?? 'default',
        targetMinutes: timer.targetMinutes,
        elapsedMilliseconds: elapsedAt(timer, now),
        mode: request.mode,
      },
      now,
    );
  }
  async current(userId: string): Promise<TimerResponse> {
    return this.transaction(userId, async (manager) => {
      const timer = await this.findCurrent(manager, userId);
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
        await this.findCurrent(manager, userId),
        now,
      );
      const target = await this.target(
        manager,
        userId,
        dto.kind,
        dto.targetId,
        now,
      );
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
        state: 'running',
        targetMinutes:
          target instanceof HabitOccurrenceEntity
            ? effectiveDuration(target, target.habit)
            : target.plannedDurationMinutes,
        elapsedMilliseconds: logged,
        segmentStartedAt: now,
        blockStartedAt: null,
        pausedAt: null,
        workLogId: null,
        targetReachedAt: null,
        pushHandledAt: null,
      });
      timer.targetReachesAt = targetReachesAt(timer);
      if (hasReachedTarget(timer, now)) {
        // Worked past the target before: reached, but nothing to announce.
        timer.targetReachedAt = now;
        timer.pushHandledAt = now;
      }
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
            await this.findCurrent(manager, userId),
            now,
          ),
          now,
        );
      }
      const timer = await this.active(manager, userId, stored, now);
      if (action === 'pause' && timer.state === 'running')
        await this.pause(manager, timer, now);
      else if (action === 'resume' && timer.state === 'paused') {
        await recordTransition(manager, timer, 'resume', now);
        // A block continued past its target stays reached; nothing is due again.
        timer.targetReachesAt = timer.targetReachedAt
          ? null
          : targetReachesAt(timer);
      }
      const saved = await manager.save(timer);
      if (action === 'resume' && focusBlock)
        await this.startFocus(
          manager,
          saved,
          await this.targetOf(manager, userId, saved, now),
          focusBlock,
          now,
        );
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
      timer.targetMinutes = minutes;
      if (hasReachedTarget(timer, now)) {
        timer.targetReachesAt = null;
        if (!timer.targetReachedAt) {
          timer.targetReachedAt = now;
          // Whoever just set this target needs no notification about it.
          timer.pushHandledAt = now;
        }
      } else {
        timer.targetReachedAt = null;
        timer.pushHandledAt = null;
        timer.targetReachesAt = targetReachesAt(timer);
      }
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
