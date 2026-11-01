import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import {
  CalendarConnectionEntity,
  CalendarLinkEntity,
  CalendarOAuthStateEntity,
  ExternalCalendarEntity,
  ExternalEventEntity,
} from './calendar.entities';
import { CalendarService } from './calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarWorker } from './calendar.worker';
import { GoogleCalendarClient } from './google-calendar.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarConnectionEntity,
      CalendarLinkEntity,
      CalendarOAuthStateEntity,
      ExternalCalendarEntity,
      ExternalEventEntity,
    ]),
  ],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarSyncService,
    CalendarWorker,
    GoogleCalendarClient,
  ],
})
export class CalendarModule {}
