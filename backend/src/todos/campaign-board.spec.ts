import { isInProgress } from './campaign-board';

const at = (time: string) => new Date(`2026-11-27T${time}:00Z`);
const open = (setAsideAt: Date | null = null) => ({
  completed: false,
  setAsideAt,
});
const idle = { openTimer: false, lastWorkEndedAt: null };

describe('isInProgress (Kampagnen-Board)', () => {
  it('is not in progress without a stopwatch or logged work', () => {
    expect(isInProgress(open(), idle)).toBe(false);
    expect(isInProgress(open(at('09:00')), idle)).toBe(false);
  });

  it('is in progress while a stopwatch runs or is paused on it', () => {
    expect(isInProgress(open(), { ...idle, openTimer: true })).toBe(true);
    expect(
      isInProgress(open(at('10:00')), {
        openTimer: true,
        lastWorkEndedAt: at('09:00'),
      }),
    ).toBe(true);
  });

  it('counts any logged work when it was never set aside', () => {
    expect(
      isInProgress(open(), { ...idle, lastWorkEndedAt: at('08:00') }),
    ).toBe(true);
  });

  it('counts only work that ends after it was set aside', () => {
    const setAside = open(at('10:00'));
    expect(
      isInProgress(setAside, { ...idle, lastWorkEndedAt: at('09:59') }),
    ).toBe(false);
    expect(
      isInProgress(setAside, { ...idle, lastWorkEndedAt: at('10:01') }),
    ).toBe(true);
  });

  it('does not count the log the set-aside itself ended', () => {
    expect(
      isInProgress(open(at('10:00')), {
        ...idle,
        lastWorkEndedAt: at('10:00'),
      }),
    ).toBe(false);
  });

  it('is never in progress once completed', () => {
    expect(
      isInProgress(
        { completed: true, setAsideAt: null },
        { openTimer: true, lastWorkEndedAt: at('10:00') },
      ),
    ).toBe(false);
  });
});
