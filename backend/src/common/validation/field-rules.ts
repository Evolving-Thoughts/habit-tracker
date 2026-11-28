import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';

/**
 * The field rules the request bodies and queries share, declared once.
 * Each is a property decorator made of class-validator's own; a DTO stacks
 * them like those. Messages are class-validator's defaults unless a caller
 * passes one, so the answers stay as they were.
 */

/** "YYYY-MM-DD" (shape only; the services check it is a real day). */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** "HH:mm", 00:00 to 23:59. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The German message where the app shows a wrong time itself. */
export const TIME_OF_DAY_MESSAGE = 'Die Uhrzeit muss als HH:MM kommen.';
/** A planned or measured stretch: one minute to one week. */
export const MIN_PLANNED_MINUTES = 1;
export const MAX_PLANNED_MINUTES = 10080;
export const MAX_TITLE_LENGTH = 200;
export const MAX_WHY_LENGTH = 1000;

/** Applies `decorators` as if stacked in this order above the property. */
function stacked(...decorators: PropertyDecorator[]): PropertyDecorator {
  return (target, key) => {
    for (const decorator of [...decorators].reverse()) decorator(target, key);
  };
}

/** A day as "YYYY-MM-DD". */
export const IsDay = (): PropertyDecorator => Matches(DAY_PATTERN);

/** A day as "YYYY-MM-DD" that is also a real calendar date. */
export const IsCalendarDay = (): PropertyDecorator =>
  stacked(IsDateString({ strict: true }), Matches(DAY_PATTERN));

/** A wall-clock time as "HH:mm". */
export const IsTimeOfDay = (options?: ValidationOptions): PropertyDecorator =>
  Matches(TIME_OF_DAY_PATTERN, options);

/** Whole minutes from 1 to 10080 (a week). */
export const IsPlannedMinutes = (): PropertyDecorator =>
  stacked(IsInt(), Min(MIN_PLANNED_MINUTES), Max(MAX_PLANNED_MINUTES));

/** A title: a non-empty string of at most 200 characters. */
export const IsTitle = (): PropertyDecorator =>
  stacked(IsString(), IsNotEmpty(), MaxLength(MAX_TITLE_LENGTH));

/** The answer to a Daily title that is empty once trimmed. */
export const INVALID_HABIT_TITLE = 'Invalid habit title';

/**
 * A Daily's title: trimmed first, then `IsTitle`; one of only spaces
 * answers `INVALID_HABIT_TITLE`. Quests keep `IsTitle`, which takes a
 * title of spaces as it is.
 */
export const IsHabitTitle = (): PropertyDecorator =>
  stacked(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty({ message: INVALID_HABIT_TITLE }),
    MaxLength(MAX_TITLE_LENGTH),
  );

/** The "why" of a quest or Daily; null clears it. */
export const IsWhy = (): PropertyDecorator =>
  stacked(IsOptional(), IsString(), MaxLength(MAX_WHY_LENGTH));

/**
 * May be left out, but when sent it must pass the other rules: unlike
 * `@IsOptional()`, null is checked (and refused) too.
 */
export const OptionalNotNull = (): PropertyDecorator =>
  ValidateIf((_object, value: unknown) => value !== undefined);
