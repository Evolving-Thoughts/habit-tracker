import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { TimersModule } from '../timers/timers.module';
import { PushSubscriptionEntity, PushDeliveryEntity } from './push.entities';
import { PushController } from './push.controller';
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
  providers: [PushService, PushTransport, PushWorker],
})
export class PushModule {}
