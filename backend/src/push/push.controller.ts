import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { CurrentUser, readSession } from '../auth/auth.guard';
import type { AuthRequest } from '../auth/auth.guard';
import { tokenHash } from '../auth/auth.crypto';
import type { AuthUser } from '../auth/auth.dto';
import { SubscribeDto, UnsubscribeDto } from './push.dto';
import { PushService } from './push.service';
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}
  @Get('config') config() {
    return this.push.config();
  }
  @Post('subscription') subscribe(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthRequest,
    @Body() dto: SubscribeDto,
  ) {
    return this.push.subscribe(user.id, tokenHash(readSession(req)!), dto);
  }
  @Delete('subscription') @HttpCode(204) unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnsubscribeDto,
  ) {
    return this.push.unsubscribe(user.id, dto.id);
  }
  @Get('deliveries/:id') confirm(
    @CurrentUser() user: AuthUser,
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.push.confirm(user.id, tokenHash(readSession(req)!), id);
  }
}
