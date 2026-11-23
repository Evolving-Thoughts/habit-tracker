import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import {
  AddFocusEntryDto,
  FocusBlockRequestDto,
  type FocusBlockStateResponse,
  SaveFocusSettingsDto,
} from './focus-block.dto';
import { FocusBlocksService } from './focus-blocks.service';

/**
 * Fokus-Sperre (docs/focus-block.md). Every answer is the whole state, so a
 * device that changed something can hand it straight to its blocker.
 */
@Controller('focus-block')
export class FocusBlocksController {
  constructor(private readonly focus: FocusBlocksService) {}

  /**
   * The state with its version as ETag: Express answers a matching
   * If-None-Match with a bodiless 304, which keeps a phone's poll cheap.
   */
  @Get()
  async state(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FocusBlockStateResponse> {
    const state = await this.focus.state(user.id);
    res.setHeader('ETag', `"${state.version}"`);
    return state;
  }

  @Put('settings')
  saveSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveFocusSettingsDto,
  ): Promise<FocusBlockStateResponse> {
    return this.focus.saveSettings(user.id, dto);
  }

  @Post('entries')
  addEntry(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddFocusEntryDto,
  ): Promise<FocusBlockStateResponse> {
    return this.focus.addEntry(user.id, dto);
  }

  @Delete('entries/:id')
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FocusBlockStateResponse> {
    return this.focus.removeEntry(user.id, id);
  }

  /** "Sperre starten" for the stopwatch that already runs. */
  @Post()
  start(
    @CurrentUser() user: AuthUser,
    @Body() dto: FocusBlockRequestDto,
  ): Promise<FocusBlockStateResponse> {
    return this.focus.start(user.id, dto);
  }

  /** "Sperre aufheben": Soft only; Hardcore answers 409 until its Soll. */
  @Post('end')
  @HttpCode(200)
  end(@CurrentUser() user: AuthUser): Promise<FocusBlockStateResponse> {
    return this.focus.end(user.id);
  }
}
