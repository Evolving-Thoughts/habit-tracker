import type {
  FocusBlockOverride,
  FocusBlockSession,
  FocusSettings,
} from "../types/focus-block";
import { formatDuration } from "./today-agenda";

/**
 * The Fokus-Sperre rules the screen needs, after the server's
 * (`backend/src/focus-blocks/focus-block-rules.ts`): whether starting the
 * stopwatch here will block, and how an open block reads.
 */

/**
 * Whether starting this quest or daily in the Fokus-Modus blocks: its own
 * "Immer" or "Nie", else Einstellungen from the threshold on (never
 * without a Soll). The server decides again; this only shows the choice.
 */
export function blockApplies(
  settings: Pick<FocusSettings, "enabled" | "thresholdMinutes">,
  override: FocusBlockOverride | undefined,
  sollMinutes: number | null,
): boolean {
  if (override === "always") return true;
  if (override === "never") return false;
  return (
    settings.enabled &&
    sollMinutes !== null &&
    sollMinutes >= settings.thresholdMinutes
  );
}

/** Whole minutes left until `endsAt`, rounded up; 0 once it is reached. */
export function remainingMinutes(endsAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - nowMs) / 60_000));
}

/** "Sperre aktiv · Hardcore · noch 12 Min." or "Sperre aktiv · Soft". */
export function blockStatusLine(
  block: Pick<FocusBlockSession, "mode" | "endsAt">,
  nowMs: number,
): string {
  if (block.mode === "soft" || !block.endsAt) return "Sperre aktiv · Soft";
  const left = remainingMinutes(block.endsAt, nowMs);
  return `Sperre aktiv · Hardcore · noch ${left > 0 ? formatDuration(left) : "unter 1 Min."}`;
}

export const OVERRIDE_LABELS: Record<FocusBlockOverride, string> = {
  default: "Standard",
  always: "Immer",
  never: "Nie",
};

/**
 * What a block never stops on the phone, whatever the lists say. The
 * Android plugin holds the actual packages (`FocusBlockPolicy`).
 */
export const FIXED_ALLOWED_APPS = [
  "Telefon und Notruf",
  "Startbildschirm, Einstellungen und Tastatur",
  "Habit Tracker (diese App)",
] as const;
