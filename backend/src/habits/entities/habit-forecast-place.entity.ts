import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HabitEntity } from './habit.entity';

/**
 * Where the person sorted a daily's run that the schedule only forecasts on
 * a later day (docs/day-order.md › Vorhergesagte Läufe). A habit has one
 * open run at a time, so the run itself is stored only on its day; until
 * then its place waits here, and the run takes it over when it is stored.
 */
@Entity({ name: 'habit_forecast_places' })
@Index(['habitId', 'date'], { unique: true })
export class HabitForecastPlaceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'integer' })
  habitId!: number;

  @ManyToOne(() => HabitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'habitId' })
  habit?: HabitEntity;

  /** The day the schedule forecasts the run for (YYYY-MM-DD). */
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'integer' })
  dayPosition!: number;
}
