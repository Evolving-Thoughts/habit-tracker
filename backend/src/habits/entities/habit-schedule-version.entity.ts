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
@Index(['habitId', 'validFrom'])
@Check(
  'CHK_habit_schedule_versions_date_range',
  '"validUntil" IS NULL OR "validUntil" >= "validFrom"',
)
export class HabitScheduleVersionEntity {
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
    type: 'enum',
    enum: HabitScheduleType,
  })
  scheduleType!: HabitScheduleType;

  @Column({
    type: 'date',
  })
  validFrom!: string;

  /**
   * Exklusives Ende:
   * validUntil = 2026-10-08 bedeutet, dass diese Version
   * ab dem 08.10.2026 nicht mehr für neue Termine gilt.
   *
   * null bedeutet: kein Ende festgelegt.
   */
  @Column({
    type: 'date',
    nullable: true,
  })
  validUntil!: string | null;

  /**
   * Ausgangspunkt des Intervallrasters.
   * Bei anderen Habit-Typen bleibt dieses Feld null.
   */
  @Column({
    type: 'date',
    nullable: true,
  })
  firstDueDate!: string | null;

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

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;
}
