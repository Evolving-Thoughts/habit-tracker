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
import { addDays, endOfDay, startOfDay } from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { TodoEntity } from '../todos/entities/todo.entity';
import { saveQuest } from '../todos/quest-commands';
import { loadTodoAncestry } from '../todos/todo-ancestry';
import { withCampaigns } from '../work-logs/day-logs';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { decryptToken } from './calendar.crypto';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
  ExternalCalendarEntity,
  ExternalEventEntity,
} from './calendar.entities';
import {
  Appointment,
  eventEdit,
  incomingStep,
  lastSyncedDay,
  logbookSince,
  logPushes,
  logSteps,
  OutgoingPlan,
  plannedTimes,
  PushOperation,
  runPushes,
  todoPushes,
} from './calendar-sync-rules';
import {
  GoogleAccessRevokedError,
  GoogleCalendar,
  GoogleCalendarClient,
  GoogleEvent,
  GoogleEventMissingError,
  GoogleForbiddenError,
} from './google-calendar.client';

/** The month view also shows the recent past of the read calendars. */
const READ_PAST_DAYS = 31;

/** One Google event across syncs: its calendar and its id there. */
function placeKey(calendarId: string, eventId: string): string {
  return `${calendarId}\n${eventId}`;
}

type Push = PushOperation<CalendarLinkEntity>;

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
      const to = endOfDay(lastSyncedDay(today));
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

  /** Carries out what each event of the own calendar asks for. */
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
      const step = incomingStep(link, event);
      if (step.kind === 'adopt')
        await this.adoptEvent(manager, userId, event, step.appointment);
      else if (step.kind === 'deleted')
        await this.applyDeletion(manager, link!);
      else if (step.kind === 'editTodo')
        await this.applyToTodo(manager, userId, link!, event);
      else if (step.kind === 'moveRun')
        await this.applyToOccurrence(manager, link!, event, step.day);
    }
  }

  /** A new event of the user's becomes an appointment. */
  private async adoptEvent(
    manager: EntityManager,
    userId: string,
    event: GoogleEvent,
    appointment: Appointment,
  ): Promise<void> {
    const repository = manager.getRepository(TodoEntity);
    const todo = await repository.save(
      repository.create({ userId, ...appointment }),
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
   * An edit that wins (`eventEdit`) moves the quest like any other move
   * (`saveQuest`): a new day or time resets its place in the order of the
   * day and drops its place in the Questlog. Unlike
   * `POST /todos/:id/reschedule` it is not refused for a past day, an
   * appointment or an open stopwatch: Google already shows the new time, as
   * after `PATCH /todos/:id`.
   */
  private async applyToTodo(
    manager: EntityManager,
    userId: string,
    link: CalendarLinkEntity,
    event: GoogleEvent,
  ): Promise<void> {
    const repository = manager.getRepository(TodoEntity);
    const todo = await repository.findOneBy({ id: link.todoId!, userId });
    const edit = todo && eventEdit(todo, link, event);
    link.remoteUpdatedAt = new Date(event.updated);
    if (todo && edit) {
      todo.title = edit.title;
      todo.plannedDurationMinutes = edit.plannedDurationMinutes;
      const saved = await saveQuest(
        manager,
        todo,
        { scheduledDate: edit.scheduledDate, timeOfDay: edit.timeOfDay },
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
    day: string | null,
  ): Promise<void> {
    link.remoteUpdatedAt = new Date(event.updated);
    link.syncedAt = new Date(0);
    if (day)
      try {
        await this.scheduling.moveRun(
          manager,
          link.userId,
          link.occurrenceId!,
          day,
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
        const times = plannedTimes(event);
        if (!times) return [];
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
  ): Promise<Push[]> {
    const links = await manager
      .getRepository(CalendarLinkEntity)
      .findBy({ userId });
    const todos = await this.todoChanges(manager, userId, today, links);
    const runs = await this.runChanges(manager, userId, today, links);
    const logs = await this.logChanges(manager, userId, today, links);
    return [...todos, ...runs, ...logs];
  }

  /** Drops the links of the plan here and hands its requests on. */
  private async carryOut(
    manager: EntityManager,
    { unlink, push }: OutgoingPlan<CalendarLinkEntity>,
  ): Promise<Push[]> {
    for (const link of unlink)
      await manager.getRepository(CalendarLinkEntity).remove(link);
    return push;
  }

  private async todoChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<Push[]> {
    const repository = manager.getRepository(TodoEntity);
    const known = await repository.find({
      where: { userId, id: In(links.flatMap((link) => link.todoId ?? [])) },
      withDeleted: true,
    });
    const open = await repository
      .createQueryBuilder('todo')
      .where('todo.userId = :userId', { userId })
      .andWhere('todo.completedAt IS NULL')
      .andWhere('todo.timeOfDay IS NOT NULL')
      .andWhere('todo.scheduledDate BETWEEN :today AND :lastDay', {
        today,
        lastDay: lastSyncedDay(today),
      })
      .getMany();
    return this.carryOut(manager, todoPushes(links, known, open));
  }

  private async runChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<Push[]> {
    const repository = manager.getRepository(HabitOccurrenceEntity);
    const known = await repository.find({
      where: { id: In(links.flatMap((link) => link.occurrenceId ?? [])) },
      relations: { habit: true },
    });
    const open = await repository.find({
      where: {
        status: HabitOccurrenceStatus.PENDING,
        habit: { userId, isActive: true },
      },
      relations: { habit: true, scheduleVersion: true },
    });
    const plan = runPushes(links, known, open, today, this.clock.now());
    return this.carryOut(manager, plan);
  }

  /** Described stretches name their title and campaign in the event. */
  private async logChanges(
    manager: EntityManager,
    userId: string,
    today: string,
    links: CalendarLinkEntity[],
  ): Promise<Push[]> {
    const repository = manager.getRepository(WorkLogEntity);
    const known = await repository.findBy({
      userId,
      id: In(links.flatMap((link) => link.workLogId ?? [])),
    });
    const recent = await repository.findBy({
      userId,
      endedAt: MoreThanOrEqual(logbookSince(today)),
    });
    const steps = logSteps(links, known, recent);
    await this.carryOut(manager, steps);
    if (!steps.patched.length && !steps.fresh.length) return steps.push;
    const ancestry = await loadTodoAncestry(manager, userId, today);
    const described = await withCampaigns(
      manager,
      userId,
      [...steps.patched.map(({ log }) => log), ...steps.fresh],
      ancestry,
    );
    return logPushes(steps, described);
  }

  private async send(
    userId: string,
    token: string,
    calendarId: string,
    operation: Push,
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
