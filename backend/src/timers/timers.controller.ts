import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import { ChangeTimerDurationDto, StartTimerDto } from './timer.dto';
import { TimersService, TimerResponse } from './timers.service';
@Controller('timers')
export class TimersController {
  constructor(private readonly service: TimersService) {}
  @Get('current') current(
    @CurrentUser() user: AuthUser,
  ): Promise<TimerResponse> {
    return this.service.current(user.id);
  }
  @Post() start(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartTimerDto,
  ): Promise<TimerResponse> {
    return this.service.start(user.id, dto);
  }
  @Post(':id/pause') pause(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimerResponse> {
    return this.service.action(user.id, id, 'pause');
  }
  @Post(':id/resume') resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimerResponse> {
    return this.service.action(user.id, id, 'resume');
  }
  @Post(':id/stop') stop(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimerResponse> {
    return this.service.action(user.id, id, 'stop');
  }
  @Patch(':id/duration') duration(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTimerDurationDto,
  ): Promise<TimerResponse> {
    return this.service.action(user.id, id, 'pause', dto.durationMinutes);
  }
}
