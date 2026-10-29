import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { dayOf } from '../common/date/local-day';
import { TimerEntity } from './timer.entity';
import { StartTimerDto } from './timer.dto';
import {
  effectiveDuration,
  isOccurrenceTimerEligible,
  isTodoTimerEligible,
  isValidTimerDuration,
  TIMER_MAX_MINUTES,
  TIMER_MIN_MINUTES,
} from './timer-target';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import {
  remainingAfterDurationChange,
  remainingMilliseconds,
} from './timer-math';
export interface TimerResponse {
  serverNow: string;
  timer: null | {
    id: string;
    kind: 'todo' | 'occurrence';
    targetId: number;
    title: string;
    state: 'running' | 'paused' | 'finished';
    durationMinutes: number;
    remainingMilliseconds: number;
    endsAt: string | null;
    finishedAt: string | null;
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
              durationMinutes: timer.durationMinutes,
              remainingMilliseconds:
                timer.state === 'running'
                  ? remainingMilliseconds(timer.endsAt!, now)
                  : timer.remainingMilliseconds,
              endsAt: timer.endsAt?.toISOString() ?? null,
              finishedAt: timer.finishedAt?.toISOString() ?? null,
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
      if (!todo) throw new NotFoundException('Todo nicht gefunden.');
      if (!isTodoTimerEligible(todo))
        throw new ConflictException('Erledigte Todos zuerst wieder öffnen.');
      return todo;
    }
    const first = await ownedOccurrences(manager, userId)
      .andWhere('occurrence.id = :id', { id })
      .getOne();
    if (!first) throw new NotFoundException('Habit-Ausführung nicht gefunden.');
    const habit = await this.scheduling.lockHabit(
      userId,
      manager,
      first.habitId,
    );
    await this.scheduling.reconcile(manager, habit, now);
    const occurrence = await manager.findOneByOrFail(HabitOccurrenceEntity, {
      id,
    });
    if (!isOccurrenceTimerEligible(occurrence, habit, dayOf(now)))
      throw new ConflictException('Keine offene fällige Habit-Ausführung.');
    occurrence.habit = habit;
    return occurrence;
  }
  private async reconcile(
    manager: EntityManager,
    userId: string,
    timer: TimerEntity | null,
    now: Date,
  ): Promise<TimerEntity | null> {
    if (!timer || timer.state === 'stopped') return timer;
    const oldState = timer.state;
    const oldTitle = timer.title;
    try {
      const target = await this.target(
        manager,
        userId,
        timer.todoId !== null ? 'todo' : 'occurrence',
        timer.todoId ?? timer.occurrenceId!,
        now,
      );
      timer.title =
        target instanceof TodoEntity ? target.title : target.habit.title;
    } catch (error) {
      if (!(
        error instanceof NotFoundException || error instanceof ConflictException
      ))
        throw error;
      timer.state = 'stopped';
      timer.endsAt = null;
      return manager.save(timer);
    }
    if (
      timer.state === 'running' &&
      remainingMilliseconds(timer.endsAt!, now) === 0
    ) {
      timer.finishedAt = timer.endsAt;
      timer.state = 'finished';
      timer.endsAt = null;
      timer.remainingMilliseconds = 0;
    }
    return timer.state !== oldState || timer.title !== oldTitle
      ? manager.save(timer)
      : timer;
  }
  private async findCurrent(
    manager: EntityManager,
    userId: string,
  ): Promise<TimerEntity | null> {
    // Prefer the unique active row; transaction start timestamps are not a reliable activity order.
    return (
      (await manager.findOne(TimerEntity, {
        where: { userId, state: In(['running', 'paused']) },
      })) ??
      (await manager.findOne(TimerEntity, {
        where: { userId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }))
    );
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
      let active = await manager.findOne(TimerEntity, {
        where: { userId, state: In(['running', 'paused']) },
      });
      let now = this.clock.now();
      active = await this.reconcile(manager, userId, active, now);
      const target = await this.target(
        manager,
        userId,
        dto.kind,
        dto.targetId,
        now,
      );
      const minutes =
        dto.durationMinutes ??
        (target instanceof HabitOccurrenceEntity
          ? effectiveDuration(target, target.habit)
          : target.plannedDurationMinutes);
      if (!isValidTimerDuration(minutes))
        throw new BadRequestException(
          `Eine Dauer zwischen ${TIMER_MIN_MINUTES} und ${TIMER_MAX_MINUTES} Minuten ist erforderlich.`,
        );
      if (active && (active.state === 'running' || active.state === 'paused')) {
        const same =
          (dto.kind === 'todo' ? active.todoId : active.occurrenceId) ===
          dto.targetId;
        if (same && active.durationMinutes === minutes && !dto.replaceTimerId)
          return this.response(active, now);
        if (dto.replaceTimerId !== active.id)
          throw new ConflictException({
            message: 'Ein anderer Timer ist bereits aktiv.',
            code: 'ACTIVE_TIMER_EXISTS',
          });
        active.state = 'stopped';
        active.endsAt = null;
        await manager.save(active);
      }
      await this.persistDuration(manager, target, minutes);
      // Determine deadline only after acquiring locks and persisting the target duration.
      now = this.clock.now();
      const timer = await manager.save(
        TimerEntity,
        manager.create(TimerEntity, {
          userId,
          todoId: dto.kind === 'todo' ? dto.targetId : null,
          occurrenceId: dto.kind === 'occurrence' ? dto.targetId : null,
          title:
            target instanceof TodoEntity ? target.title : target.habit.title,
          state: 'running',
          durationMinutes: minutes,
          remainingMilliseconds: minutes * 60_000,
          endsAt: new Date(now.getTime() + minutes * 60_000),
          finishedAt: null,
        }),
      );
      return this.response(timer, now);
    });
  }
  async action(
    userId: string,
    id: string,
    action: 'pause' | 'resume' | 'stop',
    durationMinutes?: number,
  ): Promise<TimerResponse> {
    return this.transaction(userId, async (manager) => {
      let timer = await manager.findOneBy(TimerEntity, { id, userId });
      if (!timer) throw new NotFoundException('Timer nicht gefunden.');
      const now = this.clock.now();
      if (action === 'stop') {
        timer.state = 'stopped';
        timer.endsAt = null;
        await manager.save(timer);
        const latest = await this.findCurrent(manager, userId);
        return this.response(
          await this.reconcile(manager, userId, latest, now),
          now,
        );
      }
      timer = await this.reconcile(manager, userId, timer, now);
      if (!timer || timer.state === 'stopped')
        throw new ConflictException('Der Timer ist nicht mehr aktiv.');
      if (durationMinutes !== undefined) {
        if (timer.state !== 'paused')
          throw new ConflictException('Zum Ändern der Dauer zuerst pausieren.');
        const target = await this.target(
          manager,
          userId,
          timer.todoId !== null ? 'todo' : 'occurrence',
          timer.todoId ?? timer.occurrenceId!,
          now,
        );
        timer.remainingMilliseconds = remainingAfterDurationChange(
          timer.durationMinutes,
          timer.remainingMilliseconds,
          durationMinutes,
        );
        timer.durationMinutes = durationMinutes;
        await this.persistDuration(manager, target, durationMinutes);
        if (timer.remainingMilliseconds === 0) {
          timer.state = 'finished';
          timer.finishedAt = now;
        }
      } else if (action === 'pause' && timer.state === 'running') {
        timer.remainingMilliseconds = remainingMilliseconds(timer.endsAt!, now);
        timer.endsAt = null;
        timer.state = 'paused';
      } else if (action === 'resume' && timer.state === 'paused') {
        timer.endsAt = new Date(now.getTime() + timer.remainingMilliseconds);
        timer.state = 'running';
      }
      return this.response(await manager.save(timer), now);
    });
  }
}
