import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarClient } from './google-calendar.client';

const INTERVAL_MS = 5 * 60_000;

@Injectable()
export class CalendarWorker implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly logger = new Logger('CalendarSync');

  constructor(
    private readonly sync: CalendarSyncService,
    private readonly client: GoogleCalendarClient,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || !this.client.configured()) return;
    this.interval = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
    this.interval.unref();
    void this.tick();
  }

  tick(): Promise<void> {
    this.running ??= this.sync
      .syncAll()
      .catch(() => this.logger.warn('Kalender-Abgleich fehlgeschlagen.'))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    await this.running;
  }
}
