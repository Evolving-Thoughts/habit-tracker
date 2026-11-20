import type { EntityManager } from 'typeorm';
import { WeeklyQuestTargetEntity } from './weekly-quest-target.entity';

/** One step of the goal's history: minutes from the week of `validFrom`. */
export type TargetStep = { validFrom: string; minutes: number | null };

/**
 * The goal of the week starting on `monday`: the latest step that began on
 * or before it. Before the first step there is no goal.
 */
export function targetOfWeek(
  steps: readonly TargetStep[],
  monday: string,
): number | null {
  let found: TargetStep | null = null;
  for (const step of steps)
    if (
      step.validFrom <= monday &&
      (!found || step.validFrom > found.validFrom)
    )
      found = step;
  return found?.minutes ?? null;
}

/**
 * Whether setting `minutes` from `monday` on needs a step of its own. When
 * the weeks before already lead to the same goal, a step would only repeat
 * it, so the one at `monday` (if any) goes instead.
 */
export function needsStep(
  steps: readonly TargetStep[],
  monday: string,
  minutes: number | null,
): boolean {
  const before = steps.filter((step) => step.validFrom < monday);
  return targetOfWeek(before, monday) !== minutes;
}

function stepsOf(
  manager: EntityManager,
  userId: string,
): Promise<TargetStep[]> {
  return manager.find(WeeklyQuestTargetEntity, {
    select: { validFrom: true, minutes: true },
    where: { userId },
  });
}

/**
 * The one way to read the overall weekly goal: the goal of the week that
 * starts on `monday`, for the given user only.
 */
export async function weeklyQuestTarget(
  manager: EntityManager,
  userId: string,
  monday: string,
): Promise<number | null> {
  return targetOfWeek(await stepsOf(manager, userId), monday);
}

/**
 * Sets the goal from the week of `monday` on. Earlier weeks keep theirs;
 * a step that would repeat the weeks before is removed rather than stored.
 */
export async function setWeeklyQuestTarget(
  manager: EntityManager,
  userId: string,
  monday: string,
  minutes: number | null,
): Promise<void> {
  if (needsStep(await stepsOf(manager, userId), monday, minutes))
    await manager.upsert(
      WeeklyQuestTargetEntity,
      { userId, validFrom: monday, minutes },
      ['userId', 'validFrom'],
    );
  else
    await manager.delete(WeeklyQuestTargetEntity, {
      userId,
      validFrom: monday,
    });
}
