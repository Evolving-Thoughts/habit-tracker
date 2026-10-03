import { Injectable } from '@nestjs/common';
@Injectable()
export class TimerClock {
  now(): Date {
    return new Date();
  }
}
export function remainingMilliseconds(endsAt: Date, now: Date): number {
  return Math.max(0, endsAt.getTime() - now.getTime());
}
export function remainingAfterDurationChange(
  oldMinutes: number,
  remaining: number,
  newMinutes: number,
): number {
  const elapsed = Math.max(0, oldMinutes * 60_000 - remaining);
  return Math.max(0, newMinutes * 60_000 - elapsed);
}
