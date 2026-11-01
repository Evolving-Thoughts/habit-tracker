import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager, In, Not } from 'typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitEntity } from '../habits/entities/habit.entity';
import { TodoEntity } from './entities/todo.entity';

/**
 * A habit goal on a todo: "20 runs by December". Progress is always read from
 * completed occurrences, so corrections and reopened runs just count. It stays
 * apart from the subtree progress, which only weighs todos.
 */
export type HabitGoalProgress = {
  habitId: number;
  habitTitle: string;
  target: number;
  completed: number;
  reached: boolean;
};

type Goal = Pick<
  TodoEntity,
  'periodStart' | 'periodEnd' | 'goalHabitId' | 'goalTarget'
>;

/** Pure shape rules of a period and a goal. */
export function assertGoalShape(todo: Goal): void {
  if ((todo.periodStart === null) !== (todo.periodEnd === null))
    throw new BadRequestException('Ein Zeitraum braucht Start und Ende.');
  if (
    todo.periodStart !== null &&
    todo.periodEnd !== null &&
    todo.periodStart > todo.periodEnd
  )
    throw new BadRequestException('Der Zeitraum endet vor seinem Start.');
  if ((todo.goalHabitId === null) !== (todo.goalTarget === null))
    throw new BadRequestException(
      'Ein Habit-Ziel braucht Habit und Sollmenge.',
    );
  if (todo.goalHabitId !== null && todo.periodStart === null)
    throw new BadRequestException('Ein Habit-Ziel braucht einen Zeitraum.');
}

/** A habit counts for one goal per period, so nothing is counted twice. */
export async function assertGoalAvailable(
  manager: EntityManager,
  userId: string,
  todo: TodoEntity,
): Promise<void> {
  const habitId = todo.goalHabitId ?? null;
  if (habitId === null) return;
  const owned = await manager
    .getRepository(HabitEntity)
    .existsBy({ id: habitId, userId });
  if (!owned) throw new BadRequestException('Unknown habit');
  const others = await manager.getRepository(TodoEntity).find({
    where: { userId, goalHabitId: habitId, id: Not(todo.id) },
  });
  const overlaps = others.some(
    (other) =>
      other.periodStart! <= todo.periodEnd! &&
      todo.periodStart! <= other.periodEnd!,
  );
  if (overlaps)
    throw new ConflictException(
      'Dieses Habit zählt in dem Zeitraum schon für ein anderes Ziel.',
    );
}

export async function habitGoals(
  manager: EntityManager,
  todos: TodoEntity[],
): Promise<Map<number, HabitGoalProgress>> {
  const goals = todos.filter((todo) => (todo.goalHabitId ?? null) !== null);
  const result = new Map<number, HabitGoalProgress>();
  if (!goals.length) return result;
  const habitIds = goals.map((todo) => todo.goalHabitId!);
  const [habits, completions] = await Promise.all([
    manager
      .getRepository(HabitEntity)
      .find({ where: { id: In(habitIds) }, withDeleted: true }),
    manager.getRepository(HabitOccurrenceEntity).find({
      select: { habitId: true, resolvedDate: true },
      where: {
        habitId: In(habitIds),
        status: HabitOccurrenceStatus.COMPLETED,
      },
    }),
  ]);
  for (const todo of goals) {
    const completed = completions.filter(
      (item) =>
        item.habitId === todo.goalHabitId &&
        item.resolvedDate !== null &&
        todo.periodStart! <= item.resolvedDate &&
        item.resolvedDate <= todo.periodEnd!,
    ).length;
    result.set(todo.id, {
      habitId: todo.goalHabitId!,
      habitTitle:
        habits.find((habit) => habit.id === todo.goalHabitId)?.title ?? '',
      target: todo.goalTarget!,
      completed,
      reached: completed >= todo.goalTarget!,
    });
  }
  return result;
}
