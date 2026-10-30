import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from './entities/todo.entity';
import { GoalSnapshotEntity } from './goal-snapshot.entity';
import { GoalSnapshotsService } from './goal-snapshots.service';

@Module({
  controllers: [TodosController],
  providers: [TodosService, GoalSnapshotsService],
  imports: [TypeOrmModule.forFeature([TodoEntity, GoalSnapshotEntity])],
})
export class TodosModule {}
