/** Fokus-Sperre (docs/focus-block.md). */
export type FocusBlockMode = "soft" | "hardcore";
/**
 * When a running stopwatch blocks: always (`stopwatch`, the default) or
 * only from a Soll of `thresholdMinutes` on (`threshold`).
 */
export type FocusTrigger = "stopwatch" | "threshold";
/** Block the Sperrliste, or everything but the Erlaubt-Liste. */
export type FocusListMode = "blocklist" | "allowlist";
/** A quest's or daily's own choice in its editor. */
export type FocusBlockOverride = "default" | "always" | "never";
export type FocusList = "block" | "allow";
export type FocusEntryKind = "app" | "domain";

export type FocusSettings = {
  enabled: boolean;
  trigger: FocusTrigger;
  thresholdMinutes: number;
  mode: FocusBlockMode;
  listMode: FocusListMode;
};

export type FocusEntry = {
  id: number;
  kind: FocusEntryKind;
  /** Package name or host. */
  value: string;
  /** An app's name as the phone showed it. */
  label: string | null;
};

export type FocusBlockSession = {
  id: string;
  title: string;
  todoId: number | null;
  occurrenceId: number | null;
  mode: FocusBlockMode;
  listMode: FocusListMode;
  startedAt: string;
  /**
   * Hardcore with the threshold trigger: the Soll moment it ends at. Null
   * for Soft and for Hardcore that ends with its stopwatch.
   */
  endsAt: string | null;
};

export type FocusBlockState = {
  version: string;
  serverNow: string;
  settings: FocusSettings;
  block: FocusBlockSession | null;
  lists: { block: FocusEntry[]; allow: FocusEntry[] };
  /** Hosts the app itself needs; never blocked. */
  fixedDomains: string[];
};

export type AddFocusEntryInput = {
  list: FocusList;
  kind: FocusEntryKind;
  value: string;
  label?: string;
};

/** Soft or Hardcore, picked in the Fokus-Modus before a start or resume. */
export type FocusBlockRequest = { mode?: FocusBlockMode };
