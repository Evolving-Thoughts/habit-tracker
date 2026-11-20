/** A Daily's series (Serie) as the server counts it (habits/streaks.ts). */
export type Streak = { current: number; best: number; unit: "runs" | "weeks" };

function counted(value: number, unit: Streak["unit"]): string {
  if (unit === "runs") return String(value);
  return `${value} ${value === 1 ? "Woche" : "Wochen"}`;
}

/**
 * "12 in Folge" (a weekly goal: "3 Wochen in Folge") for a Daily's row in
 * Heute, Plan and Fokus; null without a running series, so a row with none
 * says nothing rather than a zero.
 */
export function streakLine(streak: Streak | null | undefined): string | null {
  if (!streak || streak.current < 1) return null;
  return `${counted(streak.current, streak.unit)} in Folge`;
}

/**
 * "12 in Folge · Rekord 21" for the Dailies list. A broken series is a
 * number like any other ("0 in Folge · Rekord 21"), never a warning; a Daily
 * that never had one says nothing.
 */
export function streakSummary(streak: Streak | null | undefined): string | null {
  if (!streak || streak.best < 1) return null;
  return `${counted(streak.current, streak.unit)} in Folge · Rekord ${counted(
    streak.best,
    streak.unit,
  )}`;
}
