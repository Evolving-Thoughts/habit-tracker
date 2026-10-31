import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import { Clock } from '../common/clock';
import {
  addDays,
  atSameWallClock,
  atWallClockMinutes,
} from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { effectiveDuration, timersOfTodos } from '../timers/timer-target';
import { ReplanChangeResponse, ReplanPreviewResponse } from './dto/replan.dto';
import { TodoEntity } from './entities/todo.entity';
import { ReplanBlock, replanDay } from './day-replan';
import { openScheduledTodos } from './todo-agenda';

const iso = (ms: number): string => new Date(ms).toISOString();
const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

@Injectable()
export class DayReplanService {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  preview(userId: string): Promise<ReplanPreviewResponse> {
    return this.unitOfWork.run(userId, (manager) =>
      this.proposal(manager, userId),
    );
  }

  /** Applies exactly the previewed proposal, or nothing. */
  apply(userId: string, confirmationToken: string): Promise<void> {
    return this.unitOfWork.run(userId, async (manager) => {
      const proposal = await this.proposal(manager, userId);
      if (proposal.confirmationToken !== confirmationToken)
        throw new ConflictException(
          'Der Tag hat sich geändert. Prüfe die Vorschau erneut.',
        );
      const repository = manager.getRepository(TodoEntity);
      for (const change of proposal.changes) {
        const todo = await repository.findOneByOrFail({
          id: change.todoId,
          userId,
        });
        const [first, ...rest] = change.pieces;
        const later = [...rest, ...(change.tomorrow ? [change.tomorrow] : [])];
        const own = first ?? change.tomorrow!;
        todo.scheduledAt = new Date(own.start);
        todo.plannedDurationMinutes = own.minutes;
        await repository.save(todo);
        for (const piece of first ? later : []) {
          await repository.save(
            repository.create({
              userId,
              parentId: todo.id,
              categoryId: todo.categoryId,
              title: `${todo.title.slice(0, 180)} (Fortsetzung)`,
              scheduledAt: new Date(piece.start),
              plannedDurationMinutes: piece.minutes,
              isFixed: false,
            }),
          );
        }
      }
    });
  }

  async dayEnd(userId: string, dayEnd: string): Promise<void> {
    const [hours, minutes] = dayEnd.split(':').map(Number);
    await this.unitOfWork.run(userId, (manager) =>
      manager.update(
        UserEntity,
        { id: userId },
        { dayEndMinutes: hours * 60 + minutes },
      ),
    );
  }

  /** Open habit runs of the day that have a fixed time and a duration. */
  private async habitBlocks(
    manager: EntityManager,
    userId: string,
    today: string,
  ): Promise<ReplanBlock[]> {
    const occurrences = await manager.find(HabitOccurrenceEntity, {
      where: {
        status: HabitOccurrenceStatus.PENDING,
        habit: { userId, isActive: true },
      },
      relations: { habit: true },
    });
    return occurrences.flatMap((occurrence) => {
      const { timeOfDay } = occurrence.habit;
      const minutes = effectiveDuration(occurrence, occurrence.habit);
      if (!timeOfDay || !minutes || occurrenceDueDate(occurrence) !== today)
        return [];
      const [hours, mins] = timeOfDay.split(':').map(Number);
      const start = atWallClockMinutes(today, hours * 60 + mins).getTime();
      return [{ start, end: start + minutes * 60_000 }];
    });
  }

  private async proposal(
    manager: EntityManager,
    userId: string,
  ): Promise<ReplanPreviewResponse> {
    const now = this.clock.now();
    const today = this.clock.today();
    const { dayEndMinutes } = await manager.findOneByOrFail(UserEntity, {
      id: userId,
    });
    const todos = await openScheduledTodos(manager, userId, {
      firstDay: today,
      lastDay: today,
      includeOverdue: false,
    });
    const timers = await timersOfTodos(
      manager,
      userId,
      todos.map((todo) => todo.id),
    );
    const locked = new Set(
      timers
        .filter((timer) => ['running', 'paused'].includes(timer.state))
        .map((timer) => timer.todoId),
    );
    const planned = replanDay(
      todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        start: todo.scheduledAt!.getTime(),
        minutes: todo.plannedDurationMinutes,
        isFixed: todo.isFixed,
        locked: locked.has(todo.id),
      })),
      now.getTime(),
      atWallClockMinutes(today, dayEndMinutes).getTime(),
      await this.habitBlocks(manager, userId, today),
    );
    const tomorrow = addDays(today, 1);
    const changes: ReplanChangeResponse[] = planned.map((change) => ({
      todoId: change.todoId,
      title: change.title,
      from: iso(change.from),
      pieces: change.pieces.map((piece) => ({
        start: iso(piece.start),
        minutes: piece.minutes,
      })),
      tomorrow: change.tomorrowMinutes
        ? {
            start: atSameWallClock(
              new Date(change.from),
              tomorrow,
            ).toISOString(),
            minutes: change.tomorrowMinutes,
          }
        : null,
    }));
    return {
      confirmationToken: createHash('sha256')
        .update(JSON.stringify({ userId, changes }))
        .digest('hex'),
      dayEnd: clock(dayEndMinutes),
      changes,
    };
  }
}
