import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { TimerClock } from './timer.clock';
import { TimerEntity } from './timer.entity';
import { TimersController } from './timers.controller';
import { TimersService } from './timers.service';
@Module({
  imports: [TypeOrmModule.forFeature([TimerEntity]), HabitsModule],
  controllers: [TimersController],
  providers: [TimerClock, TimersService],
})
export class TimersModule {}
