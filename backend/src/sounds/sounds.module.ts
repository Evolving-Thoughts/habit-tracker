import { Module } from '@nestjs/common';
import { SoundsController } from './sounds.controller';
import { SoundsService } from './sounds.service';

@Module({
  controllers: [SoundsController],
  providers: [SoundsService],
})
export class SoundsModule {}
