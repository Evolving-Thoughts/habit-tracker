import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { TimerEntity } from './timer.entity';
import { TimersController } from './timers.controller';
import { TimersService } from './timers.service';
@Module({
  imports: [TypeOrmModule.forFeature([TimerEntity]), HabitsModule],
  controllers: [TimersController],
  providers: [TimersService],
  exports: [TimersService],
})
export class TimersModule {}
