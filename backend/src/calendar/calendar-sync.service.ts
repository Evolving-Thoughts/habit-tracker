import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Clock } from '../common/clock';
import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import {
  addDays,
  atWallClockMinutes,
  dayOf,
  endOfDay,
  startOfDay,
} from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { lastMovableDate } from '../habits/scheduling/schedule-rules';
import { effectiveDuration } from '../timers/timer-target';
import { TodoEntity } from '../todos/entities/todo.entity';
import { decryptToken } from './calendar.crypto';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
  ExternalEventEntity,
} from './calendar.entities';
import {
  GoogleAccessRevokedError,
  GoogleCalendarClient,
  GoogleEvent,
  GoogleEventInput,
  GoogleEventMissingError,
} from './google-calendar.client';

const HORIZON_DAYS = 60;
/** The month view also shows the recent past of the main calendar. */
const MAIN_CALENDAR_PAST_DAYS = 31;
const DEFAULT_MINUTES = 30;
const MINUTE_MS = 60_000;
const MARKER = 'habitTracker';

type Local = { todoId: number | null; occurrenceId: number | null };
type Change = { input: GoogleEventInput; localUpdatedAt: Date };
type PushOperation =
  | ({ type: 'insert'; local: Local } & Change)
  | ({ type: 'patch'; link: CalendarLinkEntity } & Change)
  | { type: 'delete'; link: CalendarLinkEntity };

const newest = (...dates: Date[]): Date =>
  new Date(Math.max(...dates.map((date) => date.getTime())));

function eventInput(title: string, start: Date, minutes: number) {
  return {
    summary: title,
    start: { dateTime: start.toISOString(), timeZone: DEFAULT_TIME_ZONE },
    end: {
      dateTime: new Date(start.getTime() + minutes * MINUTE_MS).toISOString(),
      timeZone: DEFAULT_TIME_ZONE,
    },
    extendedProperties: { private: { [MARKER]: 'true' } },
  };
}

/** Start and length of a timed event; all-day events have none. */
function eventTimes(
  event: GoogleEvent,
): { start: Date; end: Date; minutes: number } | null {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  const minutes = Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
  return { start, end, minutes };
}

/**
 * Exchanges a user's data with Google in two phases: incoming changes are
 * applied in one locked transaction, outgoing ones are sent afterwards so no
 * lock is held across the network. A failed run leaves the links as they are
 * and the next run picks the same work up again.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger('CalendarSync');

  constructor(
    private readonly db: DataSource,
    private readonly client: GoogleCalendarClient,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  async syncAll(): Promise<void> {
    const connections = await this.db
      .getRepository(CalendarConnectionEntity)
      .findBy({ revoked: false });
    for (const { userId } of connections) await this.syncUser(userId);
  }

  async syncUser(userId: string): Promise<void> {
    const repository = this.db.getRepository(CalendarConnectionEntity);
    const connection = await repository.findOneBy({ userId, revoked: false });
    if (!connection) return;
    try {
      const token = await this.client.accessToken(
        decryptToken(connection.refreshToken),
      );
      const today = this.clock.today();
      const from = startOfDay(today);
      const to = endOfDay(addDays(today, HORIZON_DAYS));
      const [own, main] = await Promise.all([
        this.client.listEvents(token, connection.calendarId, from, to),
        this.client.listEvents(
          token,
          'primary',
          startOfDay(addDays(today, -MAIN_CALENDAR_PAST_DAYS)),
          to,
        ),
      ]);
      const operations = await this.unitOfWork.run(userId, async (manager) => {
        await this.applyIncoming(manager, userId, own, today);
        await this.replaceExternal(manager, userId, main);
        return this.outgoing(manager, userId, today);
      });
      for (const operation of operations)
        await this.send(userId, token, connection.calendarId, operation);
      await repository.update(userId, {
        lastSyncedAt: this.clock.now(),
        lastError: null,
      });
    } catch (error) {
      const revoked = error instanceof GoogleAccessRevokedError;
      if (!revoked) this.logger.warn('Kalender-Abgleich fehlgeschlagen.');
      await repository.update(userId, {
        revoked,
        lastError: revoked
          ? 'Google hat den Zugriff beendet. Bitte neu verbinden.'
          : 'Der letzte Abgleich ist fehlgeschlagen.',
      });
    }
  }

  private async applyIncoming(
    manager: EntityManager,
    userId: string,
    events: GoogleEvent[],
    today: string,
  ): Promise<void> {
    const links = manager.getRepository(CalendarLinkEntity);
    const known = new Map(
      (await links.findBy({ userId })).map((link) => [link.eventId, link]),
    );
    for (const event of events) {
      const link = known.get(event.id);
      if (!link) await this.adoptEvent(manager, userId, event);
      else if (event.status === 'cancelled')
        await this.applyDeletion(manager, link);
      else if (new Date(event.updated) > link.remoteUpdatedAt) {
        if (link.todoId !== null)
          await this.applyToTodo(manager, userId, link, event);
        else await this.applyToOccurrence(manager, link, event, today);
      }
    }
  }

  /** A new event of the user's becomes a fixed todo. */
  private async adoptEvent(
    manager: EntityManager,
    userId: string,
    event: GoogleEvent,
  ): Promise<void> {
    const times = eventTimes(event);
    if (
      event.status === 'cancelled' ||
      !times ||
      event.extendedProperties?.private?.[MARKER]
    )
      return;
    const repository = manager.getRepository(TodoEntity);
    const todo = await repository.save(
      repository.create({
        userId,
        title: (event.summary?.trim() || 'Termin').slice(0, 200),
        scheduledAt: times.start,
        plannedDurationMinutes: times.minutes,
        isFixed: true,
      }),
    );
    await manager.getRepository(CalendarLinkEntity).save({
      userId,
      todoId: todo.id,
      occurrenceId: null,
      eventId: event.id,
      remoteUpdatedAt: new Date(event.updated),
      syncedAt: todo.updatedAt,
    });
  }

  /** Nothing is lost: a todo only loses its plan, a run only its event. */
  private async applyDeletion(
    manager: EntityManager,
    link: CalendarLinkEntity,
  ): Promise<void> {
    const links = manager.getRepository(CalendarLinkEntity);
    if (link.todoId === null) {
      if (link.suppressed) return;
      link.suppressed = true;
      await links.save(link);
      return;
    }
    await manager
      .getRepository(TodoEntity)
      .update({ id: link.todoId, userId: link.userId }, { scheduledAt: null });
    await links.remove(link);
  }

  private async applyToTodo(
    manager: EntityManager,
    userId: string,
    link: CalendarLinkEntity,
    event: GoogleEvent,
  ): Promise<void> {
    const repository = manager.getRepository(TodoEntity);
    const todo = await repository.findOneBy({ id: link.todoId!, userId });
    const times = eventTimes(event);
    const remote = new Date(event.updated);
    // Both changed: the newer one wins; the outgoing phase sends a local win.
    const localWins =
      todo !== null &&
      todo.updatedAt > link.syncedAt &&
      todo.updatedAt > remote;
    link.remoteUpdatedAt = remote;
    if (todo && times && !todo.completedAt && !localWins) {
      todo.title = (event.summary?.trim() || todo.title).slice(0, 200);
      todo.scheduledAt = times.start;
      todo.plannedDurationMinutes = times.minutes;
      link.syncedAt = (await repository.save(todo)).updatedAt;
    }
    await manager.getRepository(CalendarLinkEntity).save(link);
  }

  /**
   * A run takes over the new day if it lies in its window. Its time belongs
   * to the habit, so the next outgoing phase writes the event back to it.
   */
  private async applyToOccurrence(
    manager: EntityManager,
    link: CalendarLinkEntity,
    event: GoogleEvent,
    today: string,
  ): Promise<void> {
    const repository = manager.getRepository(HabitOccurrenceEntity);
    const occurrence = await repository.findOne({
      where: { id: link.occurrenceId! },
      relations: { scheduleVersion: true },
    });
    const times = eventTimes(event);
    link.remoteUpdatedAt = new Date(event.updated);
    link.syncedAt = new Date(0);
    if (occurrence?.status === HabitOccurrenceStatus.PENDING && times) {
      const day = dayOf(times.start);
      const { scheduledDate, scheduleVersion } = occurrence;
      if (
        day >= today &&
        day >= scheduledDate &&
        day <= lastMovableDate(scheduleVersion, scheduledDate)
      ) {
        occurrence.movedToDate = day === scheduledDate ? null : day;
        await repository.save(occurrence);
      }
    }
    await manager.getRepository(CalendarLinkEntity).save(link);
  }

  private async replaceExternal(
    manager: EntityManager,
    userId: string,
    events: GoogleEvent[],
  ): Promise<void> {
    const repository = manager.getRepository(ExternalEventEntity);
    await repository.delete({ userId });
    const rows = events.flatMap((event) => {
      const times = eventTimes(event);
      if (event.status === 'cancelled' || !times) return [];
      return [
        repository.create({
          userId,
          title: (event.summary?.trim() || 'Termin').slice(0, 500),
          start: times.start,
          end: times.end,
          busy: event.transparency !== 'transparent',
        }),
      ];
    });
    await repository.save(rows);
  }

  private async outgoing(
    manager: EntityManager,
    userId: string,
    today: string,
  ): Promise<PushOperation[]> {
    const links = await manager
      .getRepository(CalendarLinkEntity)
      .findBy({ userId });
    const todos = await this.todoChanges(manager, userId, today, links);
    const runs = await this.runChanges(manager, userId, today, links);
    return [...todos, ...runs];
  }

  private async todoChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<PushOperation[]> {
    const repository = manager.getRepository(TodoEntity);
    const linked = links.filter((link) => link.todoId !== null);
    const known = await repository.find({
      where: { userId, id: In(linked.map((link) => link.todoId!)) },
      withDeleted: true,
    });
    const operations: PushOperation[] = [];
    for (const link of linked) {
      const todo = known.find((item) => item.id === link.todoId);
      if (!todo || todo.deletedAt || !todo.scheduledAt)
        operations.push({ type: 'delete', link });
      else if (todo.completedAt)
        await manager.getRepository(CalendarLinkEntity).remove(link);
      else if (todo.updatedAt > link.syncedAt)
        operations.push({ type: 'patch', link, ...this.todoChange(todo) });
    }
    const from = startOfDay(today).getTime();
    const to = endOfDay(addDays(today, HORIZON_DAYS)).getTime();
    const open = await repository
      .createQueryBuilder('todo')
      .where('todo.userId = :userId', { userId })
      .andWhere('todo.completedAt IS NULL')
      .andWhere('todo.scheduledAt BETWEEN :from AND :to', {
        from: new Date(from),
        to: new Date(to),
      })
      .getMany();
    const taken = new Set(linked.map((link) => link.todoId));
    for (const todo of open)
      if (!taken.has(todo.id))
        operations.push({
          type: 'insert',
          local: { todoId: todo.id, occurrenceId: null },
          ...this.todoChange(todo),
        });
    return operations;
  }

  private todoChange(todo: TodoEntity): Change {
    return {
      input: eventInput(
        todo.title,
        todo.scheduledAt!,
        todo.plannedDurationMinutes ?? DEFAULT_MINUTES,
      ),
      localUpdatedAt: todo.updatedAt,
    };
  }

  private async runChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<PushOperation[]> {
    const linked = links.filter((link) => link.occurrenceId !== null);
    const known = await manager.getRepository(HabitOccurrenceEntity).find({
      where: { id: In(linked.map((link) => link.occurrenceId!)) },
      relations: { habit: true },
    });
    const operations: PushOperation[] = [];
    for (const link of linked) {
      const run = known.find((item) => item.id === link.occurrenceId);
      const open = run?.status === HabitOccurrenceStatus.PENDING;
      const planned = open && run.habit.isActive && run.habit.timeOfDay;
      if (run?.status === HabitOccurrenceStatus.COMPLETED)
        await manager.getRepository(CalendarLinkEntity).remove(link);
      else if (link.suppressed) {
        if (!open) await manager.getRepository(CalendarLinkEntity).remove(link);
      } else if (!planned) operations.push({ type: 'delete', link });
      else {
        const change = this.runChange(run);
        if (change.localUpdatedAt > link.syncedAt)
          operations.push({ type: 'patch', link, ...change });
      }
    }
    const open = await manager.getRepository(HabitOccurrenceEntity).find({
      where: {
        status: HabitOccurrenceStatus.PENDING,
        habit: { userId, isActive: true },
      },
      relations: { habit: true },
    });
    const taken = new Set(linked.map((link) => link.occurrenceId));
    const lastDay = addDays(today, HORIZON_DAYS);
    for (const run of open) {
      const due = occurrenceDueDate(run);
      if (
        !taken.has(run.id) &&
        run.habit.timeOfDay &&
        due >= today &&
        due <= lastDay
      )
        operations.push({
          type: 'insert',
          local: { todoId: null, occurrenceId: run.id },
          ...this.runChange(run),
        });
    }
    return operations;
  }

  private runChange(run: HabitOccurrenceEntity): Change {
    const [hours, minutes] = run.habit.timeOfDay!.split(':').map(Number);
    return {
      input: eventInput(
        run.habit.title,
        atWallClockMinutes(occurrenceDueDate(run), hours * 60 + minutes),
        effectiveDuration(run, run.habit) ?? DEFAULT_MINUTES,
      ),
      localUpdatedAt: newest(run.updatedAt, run.habit.updatedAt),
    };
  }

  private async send(
    userId: string,
    token: string,
    calendarId: string,
    operation: PushOperation,
  ): Promise<void> {
    const links = this.db.getRepository(CalendarLinkEntity);
    if (operation.type === 'insert') {
      const event = await this.client.insertEvent(
        token,
        calendarId,
        operation.input,
      );
      await links.save({
        userId,
        ...operation.local,
        eventId: event.id,
        remoteUpdatedAt: new Date(event.updated),
        syncedAt: operation.localUpdatedAt,
      });
      return;
    }
    const { link } = operation;
    try {
      if (operation.type === 'delete') {
        await this.client.deleteEvent(token, calendarId, link.eventId);
      } else {
        const event = await this.client.patchEvent(
          token,
          calendarId,
          link.eventId,
          operation.input,
        );
        link.remoteUpdatedAt = new Date(event.updated);
        link.syncedAt = operation.localUpdatedAt;
        await links.save(link);
        return;
      }
    } catch (error) {
      if (!(error instanceof GoogleEventMissingError)) throw error;
    }
    await links.delete({ id: link.id });
  }
}
