import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import {
  DayBestMonthsResponse,
  DayBestRangeDto,
  DayBestRangeResponse,
  DayBestResponse,
  DayBestSettingsResponse,
  SaveDayBestDto,
  SaveDayBestSettingsDto,
} from './day-best.dto';
import { DayBestsService } from './day-bests.service';

@Controller('day-bests')
export class DayBestsController {
  constructor(private readonly dayBests: DayBestsService) {}

  @Get()
  range(
    @CurrentUser() user: AuthUser,
    @Query() query: DayBestRangeDto,
  ): Promise<DayBestRangeResponse> {
    return this.dayBests.range(user.id, query.from, query.to);
  }

  // Before ":date", which would read "months" as a (bad) day.
  @Get('months')
  months(@CurrentUser() user: AuthUser): Promise<DayBestMonthsResponse> {
    return this.dayBests.months(user.id);
  }

  @Get(':date')
  find(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
  ): Promise<DayBestResponse> {
    return this.dayBests.find(user.id, date);
  }

  @Put(':date')
  save(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Body() dto: SaveDayBestDto,
  ): Promise<DayBestResponse> {
    return this.dayBests.save(user.id, date, dto.text);
  }

  @Delete(':date')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
  ): Promise<void> {
    return this.dayBests.remove(user.id, date);
  }
}

@Controller('day-best-settings')
export class DayBestSettingsController {
  constructor(private readonly dayBests: DayBestsService) {}

  @Get()
  find(@CurrentUser() user: AuthUser): Promise<DayBestSettingsResponse> {
    return this.dayBests.settings(user.id);
  }

  @Put()
  save(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveDayBestSettingsDto,
  ): Promise<DayBestSettingsResponse> {
    return this.dayBests.saveSettings(user.id, dto);
  }
}
