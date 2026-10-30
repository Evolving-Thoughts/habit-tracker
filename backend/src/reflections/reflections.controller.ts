import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { ReflectionResponse, SaveReflectionDto } from './reflection.dto';
import { ReflectionsService } from './reflections.service';

@Controller('reflections')
export class ReflectionsController {
  constructor(private readonly reflections: ReflectionsService) {}

  @Get(':date')
  find(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
  ): Promise<ReflectionResponse> {
    return this.reflections.find(user.id, date);
  }

  @Put(':date')
  save(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Body() dto: SaveReflectionDto,
  ): Promise<ReflectionResponse> {
    return this.reflections.save(user.id, date, dto.text);
  }
}
