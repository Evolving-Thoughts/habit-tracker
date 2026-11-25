import type { HabitResponse } from "../types/habit";

/** One day of a Daily's 14-day history strip. */
export type HistoryDay = NonNullable<
  HabitResponse["streak"]["recentDays"]
>[number];
export type DayMarkState = HistoryDay["state"];

/**
 * The glyph and the words of each day state in the history strip. The
 * strip and its legend both read them, so the two always match; the shape
 * differs per state, never only the colour (DESIGN.md).
 */
export const DAY_MARKS: Record<DayMarkState, { glyph: string; label: string }> =
  {
    done: { glyph: "✓", label: "Erledigt" },
    missed: { glyph: "−", label: "Verpasst" },
    skipped: { glyph: "↷", label: "Übersprungen" },
    open: { glyph: "○", label: "Noch offen" },
    free: { glyph: "·", label: "Kein Eintrag" },
  };

/** The order the legend names the states in. */
export const DAY_MARK_ORDER: DayMarkState[] = [
  "done",
  "missed",
  "skipped",
  "open",
  "free",
];
