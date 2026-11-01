import { coveredMilliseconds } from './work-time';

const at = (minute: number): Date => new Date(minute * 60_000);
const span = (from: number, to: number) => ({
  startedAt: at(from),
  endedAt: at(to),
});

describe('coveredMilliseconds', () => {
  it.each([
    ['nothing', [], 0],
    ['separate stretches', [span(0, 10), span(20, 30)], 20],
    ['partial overlap', [span(0, 10), span(5, 15)], 15],
    ['a nested stretch', [span(0, 30), span(10, 20)], 30],
    ['unsorted input', [span(20, 30), span(0, 25)], 30],
  ])('handles %s', (_name, intervals, minutes) => {
    expect(coveredMilliseconds(intervals)).toBe(minutes * 60_000);
  });
});
