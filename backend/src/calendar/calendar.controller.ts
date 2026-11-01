import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser, Public } from '../auth/auth.guard';
import { CalendarSettingDto } from './calendar.dto';
import { CalendarStatus, CalendarService } from './calendar.service';
import { CalendarSyncService } from './calendar-sync.service';

@Controller('calendar/google')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly sync: CalendarSyncService,
  ) {}

  @Get()
  status(@CurrentUser() user: AuthUser): Promise<CalendarStatus> {
    return this.calendar.status(user.id);
  }

  @Post('connect')
  @HttpCode(200)
  async connect(@CurrentUser() user: AuthUser): Promise<{ url: string }> {
    return { url: await this.calendar.connectUrl(user.id) };
  }

  /** Google sends the browser here; the frontend shows how it went. */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    try {
      if (!code || !state) throw new Error('Missing parameters');
      await this.calendar.finishConnect(code, state);
      response.redirect(`${frontend}/?calendar=connected`);
    } catch {
      response.redirect(`${frontend}/?calendar=failed`);
    }
  }

  @Post('sync')
  @HttpCode(204)
  syncNow(@CurrentUser() user: AuthUser): Promise<void> {
    return this.sync.syncUser(user.id);
  }

  @Patch('calendars')
  @HttpCode(204)
  setting(
    @CurrentUser() user: AuthUser,
    @Body() dto: CalendarSettingDto,
  ): Promise<void> {
    return this.calendar.setBlocksPlanning(
      user.id,
      dto.calendarId,
      dto.blocksPlanning,
    );
  }

  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() user: AuthUser): Promise<void> {
    return this.calendar.disconnect(user.id);
  }
}
