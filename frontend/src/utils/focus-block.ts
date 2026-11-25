import type {
  FocusBlockOverride,
  FocusBlockSession,
  FocusBlockState,
  FocusSettings,
} from "../types/focus-block";
import type { FocusBlockNativeStatus } from "../native/focus-block-plugin";
import { formatDuration } from "./today-agenda";

/**
 * The Fokus-Sperre rules the screen needs, after the server's
 * (`backend/src/focus-blocks/focus-block-rules.ts`): whether starting the
 * stopwatch will block, how an open block reads, and what keeps the phone
 * from blocking.
 */

/**
 * Whether a running stopwatch on this quest or daily blocks: its own
 * "Immer" or "Nie", else Einstellungen: on, and then always or from the
 * threshold on (never without a Soll). The server decides on every start;
 * this only shows the choice beforehand.
 */
export function blockApplies(
  settings: Pick<FocusSettings, "enabled" | "trigger" | "thresholdMinutes">,
  override: FocusBlockOverride | undefined,
  sollMinutes: number | null,
): boolean {
  if (override === "always") return true;
  if (override === "never") return false;
  if (!settings.enabled) return false;
  if (settings.trigger === "stopwatch") return true;
  return sollMinutes !== null && sollMinutes >= settings.thresholdMinutes;
}

/**
 * What keeps a block from stopping anything, in the order to fix it:
 * `empty` (Sperrliste mode with nothing on it), `accessibility` (apps on
 * the list, but the phone's accessibility service is off) and `vpn`
 * (websites on the list, but no VPN consent). The last two only in the
 * Android app, once its stand is known. A running block's list mode
 * counts, else the one from Einstellungen.
 */
export type FocusSetupIssue = "empty" | "accessibility" | "vpn";
export function focusSetupIssues(
  state: Pick<FocusBlockState, "settings" | "block" | "lists"> | null,
  device: FocusBlockNativeStatus | null,
): FocusSetupIssue[] {
  if (!state) return [];
  const strict =
    (state.block?.listMode ?? state.settings.listMode) === "allowlist";
  const blocked = state.lists.block;
  const apps = strict || blocked.some((entry) => entry.kind === "app");
  const sites = strict || blocked.some((entry) => entry.kind === "domain");
  const issues: FocusSetupIssue[] = [];
  if (!strict && !blocked.length) issues.push("empty");
  if (device && apps && !device.accessibilityEnabled)
    issues.push("accessibility");
  if (device && sites && !device.vpnPrepared) issues.push("vpn");
  return issues;
}

/** Whole minutes left until `endsAt`, rounded up; 0 once it is reached. */
export function remainingMinutes(endsAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - nowMs) / 60_000));
}

/**
 * "Sperre aktiv · Hardcore · noch 12 Min.", "Sperre aktiv · Hardcore"
 * (ends with the stopwatch) or "Sperre aktiv · Soft".
 */
export function blockStatusLine(
  block: Pick<FocusBlockSession, "mode" | "endsAt">,
  nowMs: number,
): string {
  if (block.mode === "soft") return "Sperre aktiv · Soft";
  if (!block.endsAt) return "Sperre aktiv · Hardcore";
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
