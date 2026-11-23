import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import {
  CreateMonthChallengeDto,
  MonthChallengeResponse,
  MonthChallengesResponse,
  UpdateMonthChallengeDto,
} from './month-challenge.dto';
import { MonthChallengesService } from './month-challenges.service';

@Controller('month-challenges')
export class MonthChallengesController {
  constructor(private readonly challenges: MonthChallengesService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser): Promise<MonthChallengesResponse> {
    return this.challenges.overview(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMonthChallengeDto,
  ): Promise<MonthChallengeResponse> {
    return this.challenges.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMonthChallengeDto,
  ): Promise<MonthChallengeResponse> {
    return this.challenges.update(user.id, id, dto.reminderTime);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MonthChallengeResponse> {
    return this.challenges.end(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.challenges.remove(user.id, id);
  }
}
