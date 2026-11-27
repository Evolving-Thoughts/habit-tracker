import {
  type StopwatchCatchUp,
  stopwatchCatchUp,
  type StoredStopwatch,
  type TargetAtHand,
} from './stopwatch-catch-up';

const at = (time: string): Date => new Date(`2026-11-20T${time}Z`);

/** Started at 08:00 with a 30-minute Soll, so it is reached at 08:30. */
const running: StoredStopwatch = {
  state: 'running',
  title: 'Schreiben',
  elapsedMilliseconds: 0,
  segmentStartedAt: at('08:00:00'),
  targetMinutes: 30,
  targetReachesAt: at('08:30:00'),
};
const paused: StoredStopwatch = {
  ...running,
  state: 'paused',
  elapsedMilliseconds: 10 * 60_000,
  segmentStartedAt: null,
  targetReachesAt: null,
};
const open: TargetAtHand = { eligible: true, title: 'Schreiben' };

describe('stopwatchCatchUp', () => {
  it.each<[string, StoredStopwatch, TargetAtHand, string, StopwatchCatchUp]>([
    ['running, nothing to do', running, open, '08:10:00', { outcome: 'keep' }],
    ['paused, nothing to do', paused, open, '23:00:00', { outcome: 'keep' }],
    [
      'stopped: never touched again',
      { ...running, state: 'stopped' },
      null,
      '09:00:00',
      { outcome: 'keep' },
    ],
    ['target gone', running, null, '08:10:00', { outcome: 'stop' }],
    ['paused, target gone', paused, null, '08:10:00', { outcome: 'stop' }],
    [
      'target no longer eligible',
      running,
      { eligible: false, title: 'Schreiben' },
      '08:10:00',
      { outcome: 'stop' },
    ],
    [
      'title changed',
      paused,
      { eligible: true, title: 'Kapitel 2' },
      '08:10:00',
      { outcome: 'update', title: 'Kapitel 2' },
    ],
    [
      'Soll reached meanwhile',
      running,
      open,
      '08:45:00',
      { outcome: 'update', reachedAt: at('08:30:00') },
    ],
    [
      'Soll reached exactly now',
      running,
      open,
      '08:30:00',
      { outcome: 'update', reachedAt: at('08:30:00') },
    ],
    [
      'forgotten, Soll before the cut: reached, then cut',
      running,
      open,
      '21:00:00',
      { outcome: 'update', reachedAt: at('08:30:00'), cutAt: at('20:00:00') },
    ],
    [
      'forgotten, Soll after the cut: only cut',
      { ...running, targetMinutes: 13 * 60, targetReachesAt: at('21:00:00') },
      open,
      '22:00:00',
      { outcome: 'update', cutAt: at('20:00:00') },
    ],
    [
      'forgotten without a Soll',
      { ...running, targetMinutes: null, targetReachesAt: null },
      open,
      '20:00:00',
      { outcome: 'update', cutAt: at('20:00:00') },
    ],
    [
      'everything at once',
      running,
      { eligible: true, title: 'Kapitel 2' },
      '21:00:00',
      {
        outcome: 'update',
        title: 'Kapitel 2',
        reachedAt: at('08:30:00'),
        cutAt: at('20:00:00'),
      },
    ],
  ])('%s', (_name, timer, target, now, expected) => {
    expect(stopwatchCatchUp(timer, target, at(now))).toEqual(expected);
  });
});
