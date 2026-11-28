import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  IsCalendarDay,
  IsDay,
  IsPlannedMinutes,
  IsTimeOfDay,
  IsTitle,
  IsWhy,
  OptionalNotNull,
  TIME_OF_DAY_MESSAGE,
} from './field-rules';

class Sample {
  @OptionalNotNull() @IsDay() day?: unknown;
  @OptionalNotNull() @IsCalendarDay() calendarDay?: unknown;
  @OptionalNotNull() @IsTimeOfDay() time?: unknown;
  @OptionalNotNull()
  @IsTimeOfDay({ message: TIME_OF_DAY_MESSAGE })
  germanTime?: unknown;
  @OptionalNotNull() @IsPlannedMinutes() minutes?: unknown;
  @OptionalNotNull() @IsTitle() title?: unknown;
  @IsWhy() why?: unknown;
}

/** The messages for one field of `Sample`, [] when it passes. */
function messages(field: keyof Sample, value: unknown): string[] {
  const errors = validateSync(plainToInstance(Sample, { [field]: value }));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('field rules', () => {
  it.each([
    ['day', '2026-11-28'],
    ['calendarDay', '2026-02-28'],
    ['time', '00:00'],
    ['time', '23:59'],
    ['minutes', 1],
    ['minutes', 10080],
    ['title', 'Sport'],
    ['title', 'x'.repeat(200)],
    ['why', null],
    ['why', 'x'.repeat(1000)],
  ] as const)('%s accepts %p', (field, value) => {
    expect(messages(field, value)).toEqual([]);
  });

  it.each([
    ['day', '2026-11-2'],
    ['day', '28.11.2026'],
    ['calendarDay', '2026-02-31'],
    ['calendarDay', '2026-11-28T00:00:00Z'],
    ['time', '24:00'],
    ['time', '7:30'],
    ['minutes', 0],
    ['minutes', 10081],
    ['minutes', 1.5],
    ['title', ''],
    ['title', 'x'.repeat(201)],
    ['title', 42],
    ['why', 'x'.repeat(1001)],
  ] as const)('%s refuses %p', (field, value) => {
    expect(messages(field, value)).not.toEqual([]);
  });

  it('keeps the default messages and a German one where asked', () => {
    expect(messages('minutes', 10081)).toEqual([
      'minutes must not be greater than 10080',
    ]);
    expect(messages('germanTime', '25:00')).toEqual([TIME_OF_DAY_MESSAGE]);
  });

  it('lets a field be left out but not sent as null', () => {
    expect(validateSync(plainToInstance(Sample, {}))).toEqual([]);
    expect(messages('title', null)).not.toEqual([]);
    expect(messages('day', null)).not.toEqual([]);
  });
});
