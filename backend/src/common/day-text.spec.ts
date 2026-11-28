import { BadRequestException } from '@nestjs/common';
import { assertDayTakesText } from './day-text';

describe('one text per day', () => {
  const future = 'Nur für heute und vergangene Tage.';

  it('takes today and past days, never tomorrow or a broken date', () => {
    expect(() =>
      assertDayTakesText('2026-11-23', '2026-11-23', future),
    ).not.toThrow();
    expect(() =>
      assertDayTakesText('2025-02-01', '2026-11-23', future),
    ).not.toThrow();
    expect(() =>
      assertDayTakesText('2026-11-24', '2026-11-23', future),
    ).toThrow(new BadRequestException(future));
    expect(() =>
      assertDayTakesText('2026-02-30', '2026-11-23', future),
    ).toThrow(BadRequestException);
  });
});
