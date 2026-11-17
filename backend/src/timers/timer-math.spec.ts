import {
  elapsedAt,
  forgottenSince,
  hasReachedTarget,
  MAX_SEGMENT_MS,
  Stopwatch,
  targetReachesAt,
} from './timer-math';

const at = (time: string): Date => new Date(`2026-10-03T${time}Z`);
const running = (overrides: Partial<Stopwatch> = {}): Stopwatch => ({
  state: 'running',
  elapsedMilliseconds: 0,
  segmentStartedAt: at('10:00:00'),
  targetMinutes: null,
  ...overrides,
});
const paused = (elapsedMilliseconds: number, targetMinutes = 2): Stopwatch => ({
  state: 'paused',
  elapsedMilliseconds,
  segmentStartedAt: null,
  targetMinutes,
});

describe('Stopwatch arithmetic', () => {
  it('counts up from the start of the running stretch, not from a counter', () => {
    expect(elapsedAt(running(), at('10:00:30'))).toBe(30_000);
    expect(elapsedAt(running(), at('12:00:00'))).toBe(7_200_000);
    // A clock that jumped back never yields negative time.
    expect(elapsedAt(running(), at('09:59:00'))).toBe(0);
  });

  it('adds the running stretch to what was worked before a pause', () => {
    expect(
      elapsedAt(running({ elapsedMilliseconds: 90_000 }), at('10:00:30')),
    ).toBe(120_000);
    expect(elapsedAt(paused(90_000), at('18:00:00'))).toBe(90_000);
  });

  it('knows when a running stopwatch reaches its target', () => {
    expect(targetReachesAt(running({ targetMinutes: 2 }))).toEqual(
      at('10:02:00'),
    );
    expect(
      targetReachesAt(
        running({ targetMinutes: 2, elapsedMilliseconds: 90_000 }),
      ),
    ).toEqual(at('10:00:30'));
  });

  it('has no moment to wait for without a target, while paused or past it', () => {
    expect(targetReachesAt(running())).toBeNull();
    expect(targetReachesAt(paused(30_000))).toBeNull();
    expect(
      targetReachesAt(
        running({ targetMinutes: 1, elapsedMilliseconds: 60_000 }),
      ),
    ).toBeNull();
  });

  it('reaches the target exactly at its minute and keeps counting past it', () => {
    const timer = running({ targetMinutes: 2 });
    expect(hasReachedTarget(timer, at('10:01:59'))).toBe(false);
    expect(hasReachedTarget(timer, at('10:02:00'))).toBe(true);
    expect(elapsedAt(timer, at('10:05:00'))).toBe(300_000);
    expect(hasReachedTarget(running(), at('23:00:00'))).toBe(false);
  });

  it('cuts a stretch that nobody ended after twelve hours', () => {
    expect(forgottenSince(running(), at('21:59:59'))).toBeNull();
    expect(forgottenSince(running(), at('22:00:00'))).toEqual(at('22:00:00'));
    expect(forgottenSince(running(), new Date('2026-10-05T08:00:00Z'))).toEqual(
      new Date(at('10:00:00').getTime() + MAX_SEGMENT_MS),
    );
    expect(forgottenSince(paused(1), at('23:00:00'))).toBeNull();
  });
});
