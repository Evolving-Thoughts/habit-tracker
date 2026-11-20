import { needsStep, targetOfWeek, type TargetStep } from './weekly-target';

describe('weekly goal history', () => {
  const steps: TargetStep[] = [
    { validFrom: '2026-11-16', minutes: 900 },
    { validFrom: '2000-01-03', minutes: 1200 },
    { validFrom: '2026-11-02', minutes: null },
  ];

  it('has no goal without a step', () => {
    expect(targetOfWeek([], '2026-11-16')).toBeNull();
  });

  it('takes the latest step that began on or before the week', () => {
    expect(targetOfWeek(steps, '2026-10-26')).toBe(1200);
    // A step holds from its own Monday on.
    expect(targetOfWeek(steps, '2026-11-02')).toBeNull();
    expect(targetOfWeek(steps, '2026-11-09')).toBeNull();
    expect(targetOfWeek(steps, '2026-11-16')).toBe(900);
    expect(targetOfWeek(steps, '2027-03-01')).toBe(900);
  });

  it('knows no goal before the first step', () => {
    expect(targetOfWeek(steps, '1999-12-27')).toBeNull();
  });

  it('stores a step only where it changes what the weeks before lead to', () => {
    expect(needsStep(steps, '2026-11-23', 900)).toBe(false);
    expect(needsStep(steps, '2026-11-23', 600)).toBe(true);
    // Setting the week back to what came before removes its own step.
    expect(needsStep(steps, '2026-11-16', null)).toBe(false);
    expect(needsStep(steps, '2026-11-16', 1200)).toBe(true);
    expect(needsStep([], '2026-11-16', null)).toBe(false);
  });
});
