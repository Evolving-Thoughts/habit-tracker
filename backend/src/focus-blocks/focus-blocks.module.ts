import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FocusBlockEntity,
  FocusBlockEntryEntity,
  FocusBlockSettingsEntity,
} from './focus-block.entities';
import { FocusBlocksController } from './focus-blocks.controller';
import { FocusBlocksService } from './focus-blocks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FocusBlockEntity,
      FocusBlockEntryEntity,
      FocusBlockSettingsEntity,
    ]),
  ],
  controllers: [FocusBlocksController],
  providers: [FocusBlocksService],
})
export class FocusBlocksModule {}
