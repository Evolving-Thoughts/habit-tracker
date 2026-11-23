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
import type { NotesDocument } from '../../todos/todo-notes';
import { HabitOccurrenceStatus } from '../enums/habit-occurrence-status.enum';

export type HabitOccurrenceCancellationReason =
  'schedule_changed' | 'already_completed_today' | 'weekly_target_reached';

/** The day a pending occurrence is due: its moved day, else its slot. */
export function occurrenceDueDate(occurrence: {
  scheduledDate: string;
  movedToDate?: string | null;
}): string {
  return occurrence.movedToDate ?? occurrence.scheduledDate;
}

/** Planned minutes of an occurrence, falling back to its habit's default. */
export function effectiveDuration(
  occurrence: { plannedDurationMinutes: number | null },
  habit: { plannedDurationMinutes: number | null },
): number | null {
  return occurrence.plannedDurationMinutes ?? habit.plannedDurationMinutes;
}

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

  /** Manually chosen day; the schedule slot stays `scheduledDate`. */
  @Column({ type: 'date', nullable: true })
  movedToDate!: string | null;

  /** Place in the order of its day, set by sorting; null sorts last. */
  @Column({ type: 'integer', nullable: true })
  dayPosition!: number | null;

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

  /**
   * Notes of this one run, the same rich-text document as a todo's notes
   * (see todos/todo-notes.ts). Not selected by default, like todo notes.
   */
  @Column({ type: 'jsonb', nullable: true, select: false })
  notes?: NotesDocument | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
