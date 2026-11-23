import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { MonthChallengeEntity } from './month-challenge.entity';
import { MonthChallengesController } from './month-challenges.controller';
import { MonthChallengesService } from './month-challenges.service';

@Module({
  imports: [TypeOrmModule.forFeature([MonthChallengeEntity]), HabitsModule],
  controllers: [MonthChallengesController],
  providers: [MonthChallengesService],
})
export class MonthChallengesModule {}
