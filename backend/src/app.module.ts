import { HistoryModule } from './history/history.module';
import { PushModule } from './push/push.module';
import { TimersModule } from './timers/timers.module';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { CommonModule } from './common/clock';
import { databaseOptions } from './database/database.options';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TodosModule } from './todos/todos.module';
import { HabitsModule } from './habits/habits.module';
import { DayPlannerModule } from './day-planner/day-planner.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    CommonModule,
    AuthModule,
    TimersModule,
    PushModule,
    TodosModule,
    HabitsModule,
    DayPlannerModule,
    HistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
