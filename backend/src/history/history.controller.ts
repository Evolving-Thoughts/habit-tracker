import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import { HistoryQueryDto } from './history.dto';
import { HistoryService } from './history.service';
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}
  @Get()
  get(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.history.get(user.id, query);
  }
}
