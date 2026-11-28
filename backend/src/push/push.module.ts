import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { TimersModule } from '../timers/timers.module';
import { TimersService } from '../timers/timers.service';
import { PushSubscriptionEntity, PushDeliveryEntity } from './push.entities';
import { PushController } from './push.controller';
import { PUSH_KINDS, pushKinds } from './push-kinds';
import { PushService } from './push.service';
import { PushTransport } from './push.transport';
import { PushWorker } from './push.worker';
@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscriptionEntity, PushDeliveryEntity]),
    TimersModule,
    HabitsModule,
  ],
  controllers: [PushController],
  providers: [
    PushService,
    PushTransport,
    PushWorker,
    {
      provide: PUSH_KINDS,
      inject: [TimersService, HabitSchedulingService],
      useFactory: pushKinds,
    },
  ],
})
export class PushModule {}
