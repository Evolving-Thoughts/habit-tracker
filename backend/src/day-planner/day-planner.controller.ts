import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import { Controller, Get } from '@nestjs/common';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';

@Controller('day-planner')
export class DayPlannerController {
  constructor(private readonly dayPlannerService: DayPlannerService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthUser): Promise<DayPlannerResponseDto> {
    return this.dayPlannerService.getToday(user.id);
  }
}
