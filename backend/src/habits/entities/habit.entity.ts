import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

@Entity({ name: 'habits' })
export class HabitEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title!: string;

  @Column({
    type: 'enum',
    enum: HabitScheduleType,
  })
  scheduleType!: HabitScheduleType;

  @Column({
    type: 'date',
  })
  startDate!: string;

  @Column({
    type: 'integer',
    nullable: true,
  })
  intervalDays!: number | null;

  @Column({
    type: 'enum',
    enum: Weekday,
    array: true,
    nullable: true,
  })
  weekdays!: Weekday[] | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  weeklyTarget!: number | null;

  @Column({
    type: 'enum',
    enum: MissedOccurrencePolicy,
    default: MissedOccurrencePolicy.CARRY_OVER,
  })
  missedOccurrencePolicy!: MissedOccurrencePolicy;

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
