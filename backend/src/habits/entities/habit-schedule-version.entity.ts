import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HabitEntity } from './habit.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

@Entity({ name: 'habit_schedule_versions' })
@Index(['habitId', 'effectiveAt'])
@Index('UQ_habit_schedule_versions_open', ['habitId'], {
  unique: true,
  where: '"endsAt" IS NULL AND "cancelledAt" IS NULL',
})
@Check(
  'CHK_habit_schedule_version_range',
  '"endsAt" IS NULL OR "endsAt" >= "effectiveAt"',
)
export class HabitScheduleVersionEntity {
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

  @Column({
    type: 'enum',
    enum: HabitScheduleType,
  })
  type!: HabitScheduleType;

  @Column({ type: 'timestamptz' })
  effectiveAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'date', nullable: true })
  firstDueDate!: string | null;

  @Column({ type: 'integer', nullable: true })
  intervalDays!: number | null;

  @Column({
    type: 'enum',
    enum: Weekday,
    array: true,
    nullable: true,
  })
  weekdays!: Weekday[] | null;

  @Column({ type: 'integer', nullable: true })
  weeklyTarget!: number | null;

  @Column({
    type: 'enum',
    enum: MissedOccurrencePolicy,
  })
  missedOccurrencePolicy!: MissedOccurrencePolicy;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
