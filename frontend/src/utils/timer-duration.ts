/** Mirrors the backend's timer-target bounds (TIMER_MIN/MAX_MINUTES). */
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 10080;
export const TIMER_DURATION_MESSAGE = `Bitte wähle ${TIMER_MIN_MINUTES} bis ${TIMER_MAX_MINUTES} ganze Minuten.`;

export function isValidTimerDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= TIMER_MIN_MINUTES &&
    minutes <= TIMER_MAX_MINUTES
  );
}
