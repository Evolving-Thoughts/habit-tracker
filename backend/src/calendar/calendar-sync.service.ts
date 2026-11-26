import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { Clock } from '../common/clock';
import { LiveService } from '../live/live.service';
import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import {
  addDays,
  atTimeOfDay,
  dayOf,
  endOfDay,
  startOfDay,
  timeOfDayOf,
} from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { TodoEntity } from '../todos/entities/todo.entity';
import { saveQuest } from '../todos/quest-commands';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { CampaignLog, withCampaigns } from '../work-logs/day-logs';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { decryptToken } from './calendar.crypto';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
  ExternalCalendarEntity,
  ExternalEventEntity,
} from './calendar.entities';
import {
  GoogleAccessRevokedError,
  GoogleCalendar,
  GoogleCalendarClient,
  GoogleEvent,
  GoogleEventInput,
  GoogleEventMissingError,
  GoogleForbiddenError,
} from './google-calendar.client';

const HORIZON_DAYS = 60;
/** The month view also shows the recent past of the read calendars. */
const READ_PAST_DAYS = 31;
const DEFAULT_MINUTES = 30;
const MINUTE_MS = 60_000;
const MARKER = 'habitTracker';

/** One Google event across syncs: its calendar and its id there. */
function placeKey(calendarId: string, eventId: string): string {
  return `${calendarId}\n${eventId}`;
}

/** Shorter stretches stay out of the calendar; they would only clutter it. */
const LOGBOOK_MIN_MS = 5 * MINUTE_MS;
/**
 * New stretches are exported back this far, so connecting a calendar does
 * not write the whole history at once. Linked ones are kept up to date.
 */
const LOGBOOK_PAST_DAYS = 31;

type Local = {
  todoId: number | null;
  occurrenceId: number | null;
  workLogId: number | null;
};
type Change = { input: GoogleEventInput; localUpdatedAt: Date };
type PushOperation =
  | ({ type: 'insert'; local: Local } & Change)
  | ({ type: 'patch'; link: CalendarLinkEntity } & Change)
  | { type: 'delete'; link: CalendarLinkEntity };

const newest = (...dates: Date[]): Date =>
  new Date(Math.max(...dates.map((date) => date.getTime())));

const minutesAfter = (start: Date, minutes: number): Date =>
  new Date(start.getTime() + minutes * MINUTE_MS);

function eventInput(
  summary: string,
  start: Date,
  end: Date,
  description?: string,
): GoogleEventInput {
  return {
    summary,
    ...(description ? { description } : {}),
    start: { dateTime: start.toISOString(), timeZone: DEFAULT_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: DEFAULT_TIME_ZONE },
    extendedProperties: { private: { [MARKER]: 'true' } },
  };
}

/** Only a finished stretch of at least five minutes has an event. */
const exported = (log: WorkLogEntity): boolean =>
  log.endedAt.getTime() - log.startedAt.getTime() >= LOGBOOK_MIN_MS;

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
    private readonly scheduling: HabitSchedulingService,
    private readonly live: LiveService,
  ) {}

  /**
   * The background round: what came from Google (a new event, a moved
   * appointment) reaches the person's open apps right away.
   */
  async syncAll(): Promise<void> {
    const connections = await this.db
      .getRepository(CalendarConnectionEntity)
      .findBy({ revoked: false });
    for (const { userId } of connections) {
      await this.syncUser(userId);
      this.live.notify(userId);
    }
  }

  private readonly pending = new Map<string, Promise<void>>();

  async syncUser(userId: string): Promise<void> {
    // A correction made during a sync needs a fresh read after that sync ends.
    const previous = this.pending.get(userId);
    const run = () => this.exchange(userId);
    const current = previous ? previous.then(run, run) : run();
    this.pending.set(userId, current);
    try {
      await current;
    } finally {
      if (this.pending.get(userId) === current) this.pending.delete(userId);
    }
  }

  private async exchange(userId: string): Promise<void> {
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
      const own = await this.client.listEvents(
        token,
        connection.calendarId,
        from,
        to,
      );
      const { calendars, needsConsent } = await this.readCalendars(
        token,
        connection.calendarId,
      );
      const readFrom = startOfDay(addDays(today, -READ_PAST_DAYS));
      const read = await Promise.all(
        calendars.map(async (calendar) => ({
          calendar,
          events: await this.client.listEvents(
            token,
            calendar.id,
            readFrom,
            to,
          ),
        })),
      );
      const operations = await this.unitOfWork.run(userId, async (manager) => {
        await this.applyIncoming(manager, userId, own);
        await this.replaceExternal(manager, userId, read, needsConsent);
        return this.outgoing(manager, userId, today);
      });
      for (const operation of operations)
        await this.send(userId, token, connection.calendarId, operation);
      await repository.update(userId, {
        lastSyncedAt: this.clock.now(),
        lastError: null,
        needsConsent,
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

  /**
   * The calendars shown in Google, without the app's own. A token from before
   * the calendar list permission still reads the main calendar.
   */
  private async readCalendars(
    token: string,
    ownCalendarId: string,
  ): Promise<{ calendars: GoogleCalendar[]; needsConsent: boolean }> {
    try {
      const calendars = await this.client.listCalendars(token);
      return {
        calendars: calendars.filter(
          ({ id, selected, primary }) =>
            id !== ownCalendarId && (selected || primary),
        ),
        needsConsent: false,
      };
    } catch (error) {
      if (!(error instanceof GoogleForbiddenError)) throw error;
      return {
        calendars: [{ id: 'primary', summary: 'Hauptkalender', primary: true }],
        needsConsent: true,
      };
    }
  }

  private async applyIncoming(
    manager: EntityManager,
    userId: string,
    events: GoogleEvent[],
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
      // A Logbuch event only reports measured work: an edit in Google
      // neither changes the log nor turns the event into a plan.
      else if (link.workLogId !== null) continue;
      else if (new Date(event.updated) > link.remoteUpdatedAt) {
        if (link.todoId !== null)
          await this.applyToTodo(manager, userId, link, event);
        else await this.applyToOccurrence(manager, link, event);
      }
    }
  }

  /** A new event of the user's becomes an appointment. */
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
        scheduledDate: dayOf(times.start),
        timeOfDay: timeOfDayOf(times.start),
        plannedDurationMinutes: times.minutes,
      }),
    );
    await manager.getRepository(CalendarLinkEntity).save({
      userId,
      todoId: todo.id,
      occurrenceId: null,
      workLogId: null,
      eventId: event.id,
      remoteUpdatedAt: new Date(event.updated),
      syncedAt: todo.updatedAt,
    });
  }

  /**
   * Nothing is lost: a todo only loses its plan, a run or a work log only
   * its event. Their link stays, suppressed, so the event is not written again.
   * The todo goes back to the Questlog through `saveQuest`, but without a
   * place there (`backlogPlace: 'none'`, see `day-order.md`): it follows the
   * quests the user sorted.
   */
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
    const todo = await manager.getRepository(TodoEntity).findOne({
      where: { id: link.todoId, userId: link.userId },
      withDeleted: true,
    });
    if (todo)
      await saveQuest(
        manager,
        todo,
        { scheduledDate: null },
        this.clock.now(),
        { backlogPlace: 'none' },
      );
    await links.remove(link);
  }

  /**
   * The newer side wins. A change from Google moves the quest like any other
   * move (`saveQuest`): a new day or time resets its place in the order of
   * the day and drops its place in the Questlog. Unlike
   * `POST /todos/:id/reschedule` it is not refused for a past day, an
   * appointment or an open stopwatch: Google already shows the new time, as
   * after `PATCH /todos/:id`. A completed quest is left alone.
   */
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
      todo.plannedDurationMinutes = times.minutes;
      const saved = await saveQuest(
        manager,
        todo,
        {
          scheduledDate: dayOf(times.start),
          timeOfDay: timeOfDayOf(times.start),
        },
        this.clock.now(),
      );
      link.syncedAt = saved.updatedAt;
    }
    await manager.getRepository(CalendarLinkEntity).save(link);
  }

  /**
   * A run takes over the new day if it may move there, by the rules of
   * `POST /habit-occurrences/:id/reschedule` (`moveRun`: an open run of the
   * active version of an active habit, within its window, no open
   * stopwatch); otherwise the move is not taken. Its time belongs to the
   * habit, so the next outgoing phase writes the event back to it.
   */
  private async applyToOccurrence(
    manager: EntityManager,
    link: CalendarLinkEntity,
    event: GoogleEvent,
  ): Promise<void> {
    const times = eventTimes(event);
    link.remoteUpdatedAt = new Date(event.updated);
    link.syncedAt = new Date(0);
    if (times)
      try {
        await this.scheduling.moveRun(
          manager,
          link.userId,
          link.occurrenceId!,
          dayOf(times.start),
          this.clock.now(),
        );
      } catch (error) {
        if (!(
          error instanceof ConflictException ||
          error instanceof NotFoundException
        ))
          throw error;
      }
    await manager.getRepository(CalendarLinkEntity).save(link);
  }

  /** New calendars block planning only if they are the main calendar. */
  private async replaceExternal(
    manager: EntityManager,
    userId: string,
    read: { calendar: GoogleCalendar; events: GoogleEvent[] }[],
    keepCalendars: boolean,
  ): Promise<void> {
    const calendars = manager.getRepository(ExternalCalendarEntity);
    const known = await calendars.findBy({ userId });
    if (!keepCalendars) {
      const current = new Set(read.map(({ calendar }) => calendar.id));
      await calendars.remove(known.filter((c) => !current.has(c.calendarId)));
    }
    const repository = manager.getRepository(ExternalEventEntity);
    // The rows are replaced; the places the user sorted them into and the
    // ticks they gave them stay.
    const kept = new Map(
      (
        await repository.find({
          select: {
            calendarId: true,
            eventId: true,
            dayPosition: true,
            doneAt: true,
          },
          where: [
            { userId, dayPosition: Not(IsNull()) },
            { userId, doneAt: Not(IsNull()) },
          ],
        })
      ).map((row) => [placeKey(row.calendarId, row.eventId), row]),
    );
    await repository.delete({ userId });
    for (const { calendar, events } of read) {
      await calendars.save({
        userId,
        calendarId: calendar.id,
        title: (calendar.summary?.trim() || 'Kalender').slice(0, 300),
        primary: calendar.primary ?? false,
      });
      const rows = events.flatMap((event) => {
        const times = eventTimes(event);
        if (
          event.status === 'cancelled' ||
          !times ||
          event.extendedProperties?.private?.[MARKER]
        )
          return [];
        return [
          repository.create({
            userId,
            calendarId: calendar.id,
            title: (event.summary?.trim() || 'Termin').slice(0, 500),
            start: times.start,
            end: times.end,
            eventId: event.id,
            dayPosition:
              kept.get(placeKey(calendar.id, event.id))?.dayPosition ?? null,
            doneAt: kept.get(placeKey(calendar.id, event.id))?.doneAt ?? null,
          }),
        ];
      });
      await repository.save(rows);
    }
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
    const logs = await this.logChanges(manager, userId, today, links);
    return [...todos, ...runs, ...logs];
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
      // Only an appointment has an event; a todo that lost its time loses it.
      if (!todo || todo.deletedAt || !todo.scheduledDate || !todo.timeOfDay)
        operations.push({ type: 'delete', link });
      else if (todo.completedAt)
        await manager.getRepository(CalendarLinkEntity).remove(link);
      else if (todo.updatedAt > link.syncedAt)
        operations.push({ type: 'patch', link, ...this.todoChange(todo) });
    }
    const open = await repository
      .createQueryBuilder('todo')
      .where('todo.userId = :userId', { userId })
      .andWhere('todo.completedAt IS NULL')
      .andWhere('todo.timeOfDay IS NOT NULL')
      .andWhere('todo.scheduledDate BETWEEN :today AND :lastDay', {
        today,
        lastDay: addDays(today, HORIZON_DAYS),
      })
      .getMany();
    const taken = new Set(linked.map((link) => link.todoId));
    for (const todo of open)
      if (!taken.has(todo.id))
        operations.push({
          type: 'insert',
          local: { todoId: todo.id, occurrenceId: null, workLogId: null },
          ...this.todoChange(todo),
        });
    return operations;
  }

  private todoChange(todo: TodoEntity): Change {
    const start = atTimeOfDay(todo.scheduledDate!, todo.timeOfDay!);
    return {
      input: eventInput(
        todo.title,
        start,
        minutesAfter(start, todo.plannedDurationMinutes ?? DEFAULT_MINUTES),
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
          local: { todoId: null, occurrenceId: run.id, workLogId: null },
          ...this.runChange(run),
        });
    }
    return operations;
  }

  private runChange(run: HabitOccurrenceEntity): Change {
    const start = atTimeOfDay(occurrenceDueDate(run), run.habit.timeOfDay!);
    return {
      input: eventInput(
        run.habit.title,
        start,
        minutesAfter(
          start,
          effectiveDuration(run, run.habit) ?? DEFAULT_MINUTES,
        ),
      ),
      localUpdatedAt: newest(run.updatedAt, run.habit.updatedAt),
    };
  }

  /**
   * The Logbuch only goes out: every finished stretch of five minutes or more
   * becomes an event at its real times. A corrected log (moved, lengthened
   * or shortened) patches its event; only a deleted log loses it. An event
   * deleted in Google stays
   * deleted: its link is kept suppressed until the log itself goes.
   */
  private async logChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<PushOperation[]> {
    const repository = manager.getRepository(WorkLogEntity);
    const linked = links.filter((link) => link.workLogId !== null);
    const known = await repository.findBy({
      userId,
      id: In(linked.map((link) => link.workLogId!)),
    });
    const taken = new Set(linked.map((link) => link.workLogId));
    const fresh = (
      await repository.findBy({
        userId,
        endedAt: MoreThanOrEqual(
          startOfDay(addDays(today, -LOGBOOK_PAST_DAYS)),
        ),
      })
    ).filter((log) => !taken.has(log.id) && exported(log));

    const operations: PushOperation[] = [];
    const patched: { link: CalendarLinkEntity; log: WorkLogEntity }[] = [];
    for (const link of linked) {
      const log = known.find((item) => item.id === link.workLogId);
      if (link.suppressed) {
        if (!log) await manager.getRepository(CalendarLinkEntity).remove(link);
      } else if (!log) operations.push({ type: 'delete', link });
      else if (log.updatedAt > link.syncedAt) patched.push({ link, log });
    }
    if (!patched.length && !fresh.length) return operations;

    const ancestry = await loadTodoAncestry(manager, userId, today);
    const described = await withCampaigns(
      manager,
      userId,
      [...patched.map(({ log }) => log), ...fresh],
      ancestry,
    );
    const change = (id: number): Change =>
      this.logChange(described.find((log) => log.id === id)!);
    for (const { link, log } of patched)
      operations.push({ type: 'patch', link, ...change(log.id) });
    for (const log of fresh)
      operations.push({
        type: 'insert',
        local: { todoId: null, occurrenceId: null, workLogId: log.id },
        ...change(log.id),
      });
    return operations;
  }

  /** Named as Logbuch in Google, so it never reads as a plan. */
  private logChange(log: CampaignLog): Change {
    const description = [
      'Logbuch · gemessene Arbeitszeit',
      ...(log.campaign ? [`Kampagne: ${log.campaign.title}`] : []),
    ].join('\n');
    return {
      input: eventInput(log.title, log.startedAt, log.endedAt, description),
      localUpdatedAt: log.updatedAt,
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
      // Deleted in Google: a Logbuch event stays deleted, a plan is written anew.
      if (operation.type === 'patch' && link.workLogId !== null) {
        await links.update(link.id, { suppressed: true });
        return;
      }
    }
    await links.delete({ id: link.id });
  }
}
