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

export type HabitOccurrenceCancellationReason =
  'schedule_changed' | 'already_completed_today' | 'weekly_target_reached';

@Entity({ name: 'habit_occurrences' })
@Index(['scheduleVersionId', 'scheduledDate'], { unique: true })
@Index('UQ_habit_occurrences_pending', ['habitId'], {
  unique: true,
  where: `"status" = 'pending'`,
})
export class HabitOccurrenceEntity {
  @Column({ type: 'integer', nullable: true })
  plannedDurationMinutes!: number | null;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  habitId!: number;

  @ManyToOne(() => HabitEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'habitId' })
  habit!: HabitEntity;

  @Column({ type: 'integer' })
  scheduleVersionId!: number;

  @ManyToOne(() => HabitScheduleVersionEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'scheduleVersionId' })
  scheduleVersion!: HabitScheduleVersionEntity;

  @Column({ type: 'date' })
  scheduledDate!: string;

  @Column({
    type: 'enum',
    enum: HabitOccurrenceStatus,
    default: HabitOccurrenceStatus.PENDING,
  })
  status!: HabitOccurrenceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'date', nullable: true })
  resolvedDate!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  cancellationReason!: HabitOccurrenceCancellationReason | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
