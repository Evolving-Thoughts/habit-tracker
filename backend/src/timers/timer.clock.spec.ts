import {
  remainingAfterDurationChange,
  remainingMilliseconds,
} from './timer.clock';
describe('Timer clock arithmetic', () => {
  it('uses the deadline, not a decrement counter', () => {
    const end = new Date('2026-10-03T10:01:00Z');
    expect(remainingMilliseconds(end, new Date('2026-10-03T10:00:30Z'))).toBe(
      30000,
    );
    expect(remainingMilliseconds(end, new Date('2026-10-03T10:02:00Z'))).toBe(
      0,
    );
  });
  it('preserves elapsed time when changing total duration', () => {
    expect(remainingAfterDurationChange(2, 90000, 3)).toBe(150000);
    expect(remainingAfterDurationChange(2, 30000, 1)).toBe(0);
  });
});
