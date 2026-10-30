import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkLogEntity } from './work-log.entity';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkLogEntity])],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
})
export class WorkLogsModule {}
