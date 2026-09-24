import { DEFAULT_TIME_ZONE, getCurrentDateInTimeZone } from './date-only.utils';

describe('date-only utilities', () => {
  describe('getCurrentDateInTimeZone', () => {
    it('uses Europe/Berlin as the default time zone', () => {
      expect(DEFAULT_TIME_ZONE).toBe('Europe/Berlin');

      expect(
        getCurrentDateInTimeZone(
          undefined,
          new Date('2026-09-18T22:30:00.000Z'),
        ),
      ).toBe('2026-09-19');
    });

    it('returns the date in the requested time zone', () => {
      const now = new Date('2026-09-18T22:30:00.000Z');

      expect(getCurrentDateInTimeZone('Europe/Berlin', now)).toBe('2026-09-19');

      expect(getCurrentDateInTimeZone('UTC', now)).toBe('2026-09-18');
    });

    it('handles winter time correctly', () => {
      expect(
        getCurrentDateInTimeZone(
          'Europe/Berlin',
          new Date('2026-12-31T23:30:00.000Z'),
        ),
      ).toBe('2027-01-01');
    });
  });
});
