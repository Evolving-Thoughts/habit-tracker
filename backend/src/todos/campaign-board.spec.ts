import {
  complete,
  isInProgress,
  markBlocked,
  reopen,
  resumeWork,
  setAside,
  takeIntoWork,
} from './campaign-board';

const at = (time: string) => new Date(`2026-11-27T${time}:00Z`);
const open = (
  setAsideAt: Date | null = null,
  startedAt: Date | null = null,
) => ({ completed: false, setAsideAt, startedAt });
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

  it('is in progress once taken up by hand, until it is set aside again', () => {
    expect(isInProgress(open(null, at('09:00')), idle)).toBe(true);
    expect(isInProgress(open(at('08:00'), at('09:00')), idle)).toBe(true);
    expect(isInProgress(open(at('10:00'), at('09:00')), idle)).toBe(false);
  });

  it('is never in progress once completed', () => {
    expect(
      isInProgress(
        { completed: true, setAsideAt: null, startedAt: at('09:00') },
        { openTimer: true, lastWorkEndedAt: at('10:00') },
      ),
    ).toBe(false);
  });
});

describe('board transitions (Kampagnen-Board)', () => {
  const now = at('12:00');
  const free = { completed: false, blocked: false };
  const blocked = { completed: false, blocked: true };
  const done = { completed: true, blocked: false };
  const refused = { refused: 'completed' };

  // One row per transition and case, kept on one line each.
  // prettier-ignore
  it.each([
    ['set aside', setAside(free, false, now), { setAsideAt: now, blocked: false }],
    ['set aside, blocked', setAside(free, true, now), { setAsideAt: now, blocked: true }],
    ['set aside, unblocked', setAside(blocked, false, now), { setAsideAt: now, blocked: false }],
    ['set aside when completed', setAside(done, true, now), refused],
    ['take into work', takeIntoWork(free, now), { startedAt: now }],
    ['take into work, blocked', takeIntoWork(blocked, now), { startedAt: now, blocked: false }],
    ['take into work when completed', takeIntoWork(done, now), refused],
    ['resume work', resumeWork(free), {}],
    ['resume work, blocked', resumeWork(blocked), { blocked: false }],
    ['complete', complete(free), {}],
    ['complete, blocked', complete(blocked), { blocked: false }],
    ['reopen', reopen(done, now), { setAsideAt: now }],
    ['reopen an open quest', reopen(free, now), {}],
    ['mark blocked', markBlocked(free, true), { blocked: true }],
    ['unmark blocked', markBlocked(blocked, false), { blocked: false }],
    ['unmark blocked when completed', markBlocked(done, false), { blocked: false }],
    ['mark blocked when completed', markBlocked(done, true), refused],
  ])('%s', (_name, outcome, expected) => {
    expect(outcome).toEqual(expected);
  });

  it('is in progress once taken into work, until it is set aside', () => {
    const quest = { ...free, setAsideAt: null, startedAt: null };
    const taken = { ...quest, ...takeIntoWork(quest, at('09:00')) };
    expect(isInProgress(taken, idle)).toBe(true);
    const setBack = { ...taken, ...setAside(taken, false, at('10:00')) };
    expect(isInProgress(setBack, idle)).toBe(false);
  });
});
