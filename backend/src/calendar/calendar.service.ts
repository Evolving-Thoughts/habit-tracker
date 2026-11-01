import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomToken, tokenHash } from '../auth/auth.crypto';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { decryptToken, encryptToken } from './calendar.crypto';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
  CalendarOAuthStateEntity,
  ExternalCalendarEntity,
  ExternalEventEntity,
} from './calendar.entities';
import { GoogleCalendarClient } from './google-calendar.client';
import { CalendarSyncService } from './calendar-sync.service';

const STATE_MINUTES = 10;
const CALENDAR_NAME = 'Habit Tracker';

export type ReadCalendar = {
  id: string;
  title: string;
  primary: boolean;
  blocksPlanning: boolean;
};

export type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  revoked: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  needsConsent: boolean;
  calendars: ReadCalendar[];
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly db: DataSource,
    private readonly client: GoogleCalendarClient,
    private readonly sync: CalendarSyncService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  async status(userId: string): Promise<CalendarStatus> {
    const connection = await this.db
      .getRepository(CalendarConnectionEntity)
      .findOneBy({ userId });
    return {
      configured: this.client.configured(),
      connected: connection !== null && !connection.revoked,
      revoked: connection?.revoked ?? false,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
      lastError: connection?.lastError ?? null,
      needsConsent: connection?.needsConsent ?? false,
      calendars: connection
        ? (
            await this.db.getRepository(ExternalCalendarEntity).find({
              where: { userId },
              order: { primary: 'DESC', title: 'ASC' },
            })
          ).map(({ calendarId, title, primary, blocksPlanning }) => ({
            id: calendarId,
            title,
            primary,
            blocksPlanning,
          }))
        : [],
    };
  }

  async setBlocksPlanning(
    userId: string,
    calendarId: string,
    blocksPlanning: boolean,
  ): Promise<void> {
    const { affected } = await this.db
      .getRepository(ExternalCalendarEntity)
      .update({ userId, calendarId }, { blocksPlanning });
    if (!affected) throw new NotFoundException();
  }

  async connectUrl(userId: string): Promise<string> {
    if (!this.client.configured())
      throw new ServiceUnavailableException(
        'Die Google-Anbindung ist nicht eingerichtet.',
      );
    const state = randomToken();
    await this.db.getRepository(CalendarOAuthStateEntity).save({
      tokenHash: tokenHash(state),
      userId,
      expiresAt: new Date(this.clock.now().getTime() + STATE_MINUTES * 60_000),
    });
    return this.client.authUrl(state);
  }

  /** Runs without a session: the single-use state identifies the user. */
  async finishConnect(code: string, state: string): Promise<void> {
    const states = this.db.getRepository(CalendarOAuthStateEntity);
    const stored = await states.findOneBy({ tokenHash: tokenHash(state) });
    if (!stored) throw new Error('Unknown state');
    await states.delete({ tokenHash: stored.tokenHash });
    if (stored.expiresAt <= this.clock.now()) throw new Error('Expired state');

    const { userId } = stored;
    const refreshToken = await this.client.exchangeCode(code);
    const connections = this.db.getRepository(CalendarConnectionEntity);
    const existing = await connections.findOneBy({ userId });
    const calendarId =
      existing?.calendarId ??
      (await this.client.createCalendar(
        await this.client.accessToken(refreshToken),
        CALENDAR_NAME,
      ));
    await connections.save({
      userId,
      calendarId,
      refreshToken: encryptToken(refreshToken),
      revoked: false,
      lastError: null,
      needsConsent: false,
    });
    await this.sync.syncUser(userId);
  }

  /** Stops the exchange. Events stay in Google, todos stay in the app. */
  async disconnect(userId: string): Promise<void> {
    const connection = await this.unitOfWork.run(userId, async (manager) => {
      const found = await manager.findOneBy(CalendarConnectionEntity, {
        userId,
      });
      await manager.delete(CalendarLinkEntity, { userId });
      await manager.delete(ExternalEventEntity, { userId });
      await manager.delete(ExternalCalendarEntity, { userId });
      await manager.delete(CalendarConnectionEntity, { userId });
      return found;
    });
    if (connection)
      await this.client
        .revoke(decryptToken(connection.refreshToken))
        .catch(() => undefined);
  }
}
