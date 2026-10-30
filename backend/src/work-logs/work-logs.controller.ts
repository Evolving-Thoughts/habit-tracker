import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import {
  CreateWorkLogDto,
  WorkDayResponse,
  WorkLogResponse,
  WorkLogTimesDto,
} from './work-log.dto';
import { WorkLogsService } from './work-logs.service';

@Controller('work-logs')
export class WorkLogsController {
  constructor(private readonly logs: WorkLogsService) {}

  @Get()
  day(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
  ): Promise<WorkDayResponse> {
    return this.logs.day(user.id, date ?? '');
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWorkLogDto,
  ): Promise<WorkLogResponse> {
    return this.logs.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WorkLogTimesDto,
  ): Promise<WorkLogResponse> {
    return this.logs.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.logs.remove(user.id, id);
  }
}
