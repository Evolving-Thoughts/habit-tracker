import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HabitEntity } from '../../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../../habits/entities/habit-schedule-version.entity';
import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

@Entity({ name: 'habit_occurrences' })
@Index(['habitId', 'scheduledDate'], {
  unique: true,
})
@Index(['scheduleVersionId'])
export class HabitOccurrenceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'integer',
  })
  habitId!: number;

  @ManyToOne(() => HabitEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'habitId',
  })
  habit!: HabitEntity;

  @Column({
    type: 'integer',
    nullable: true,
  })
  scheduleVersionId!: number | null;

  @ManyToOne(() => HabitScheduleVersionEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'scheduleVersionId',
  })
  scheduleVersion!: HabitScheduleVersionEntity | null;

  @Column({
    type: 'date',
  })
  scheduledDate!: string;

  @Column({
    type: 'enum',
    enum: HabitOccurrenceStatus,
    default: HabitOccurrenceStatus.PENDING,
  })
  status!: HabitOccurrenceStatus;

  @Column({
    type: 'date',
    nullable: true,
  })
  resolvedDate!: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
