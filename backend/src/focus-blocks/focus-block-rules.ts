import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * The rules of the Fokus-Sperre that need no database (docs/focus-block.md):
 * when starting the stopwatch from the Fokus-Modus starts a block, when a
 * block ends by itself, who may lift it, what a list entry looks like and
 * which hosts a list blocks. The Android plugin repeats the host and package
 * rules in `FocusBlockPolicy`; both follow this file.
 */

export const FOCUS_BLOCK_MODES = ['soft', 'hardcore'] as const;
export type FocusBlockMode = (typeof FOCUS_BLOCK_MODES)[number];

/** Block what is on the Sperrliste, or everything but the Erlaubt-Liste. */
export const FOCUS_LIST_MODES = ['blocklist', 'allowlist'] as const;
export type FocusListMode = (typeof FOCUS_LIST_MODES)[number];

/** A quest's or daily's own choice: the default rule, always, or never. */
export const FOCUS_BLOCK_OVERRIDES = ['default', 'always', 'never'] as const;
export type FocusBlockOverride = (typeof FOCUS_BLOCK_OVERRIDES)[number];

export const FOCUS_LISTS = ['block', 'allow'] as const;
export type FocusList = (typeof FOCUS_LISTS)[number];

export const FOCUS_ENTRY_KINDS = ['app', 'domain'] as const;
export type FocusEntryKind = (typeof FOCUS_ENTRY_KINDS)[number];

export const FOCUS_END_REASONS = [
  'lifted',
  'stopwatch_stopped',
  'completed',
  'target_reached',
  'expired',
] as const;
export type FocusEndReason = (typeof FOCUS_END_REASONS)[number];

/** "Ab Soll von 15 Min." until the person picks another threshold. */
export const DEFAULT_THRESHOLD_MINUTES = 15;
export const MAX_THRESHOLD_MINUTES = 600;
/**
 * A Soft block whose stopwatch nobody ends lifts itself after this long,
 * like the stopwatch's own cut for forgotten stretches.
 */
export const SOFT_BLOCK_MAX_MS = 12 * 60 * 60_000;
/** At most this many entries per list and kind. */
export const MAX_ENTRIES_PER_LIST = 200;

export type FocusTrigger = { enabled: boolean; thresholdMinutes: number };

/**
 * Whether starting the stopwatch in the Fokus-Modus starts a block: a
 * quest's or daily's own "Immer" or "Nie" decides; "Standard" follows
 * Einstellungen, which block from a Soll of `thresholdMinutes` on. Without
 * a Soll, "Standard" never blocks.
 */
export function blockApplies(
  trigger: FocusTrigger,
  override: FocusBlockOverride,
  sollMinutes: number | null,
): boolean {
  if (override === 'always') return true;
  if (override === 'never') return false;
  return (
    trigger.enabled &&
    sollMinutes !== null &&
    sollMinutes >= trigger.thresholdMinutes
  );
}

/**
 * When a Hardcore block ends: the moment the stopwatch reaches its Soll,
 * counted from the start of the block. Pausing does not move it. Null when
 * nothing is left to reach (no Soll, or already reached): such a block
 * starts as Soft.
 */
export function hardcoreEndsAt(
  targetMinutes: number | null,
  elapsedMilliseconds: number,
  now: Date,
): Date | null {
  if (targetMinutes === null) return null;
  const remaining = targetMinutes * 60_000 - elapsedMilliseconds;
  return remaining > 0 ? new Date(now.getTime() + remaining) : null;
}

export type BlockTiming = {
  mode: FocusBlockMode;
  startedAt: Date;
  endsAt: Date | null;
  endedAt: Date | null;
};

/**
 * Why a block that nobody ended is over at `now`, or null while it holds:
 * Hardcore at its Soll moment, Soft after `SOFT_BLOCK_MAX_MS`.
 */
export function lapsedReason(
  block: BlockTiming,
  now: Date,
): 'target_reached' | 'expired' | null {
  if (block.endedAt) return null;
  if (block.mode === 'hardcore')
    return block.endsAt && block.endsAt <= now ? 'target_reached' : null;
  return block.startedAt.getTime() + SOFT_BLOCK_MAX_MS <= now.getTime()
    ? 'expired'
    : null;
}

/** When a block lapses by itself: Hardcore at its Soll, Soft after 12 hours. */
export function lapsesAt(block: BlockTiming): Date {
  return block.mode === 'hardcore' && block.endsAt
    ? block.endsAt
    : new Date(block.startedAt.getTime() + SOFT_BLOCK_MAX_MS);
}

/**
 * Lifting by hand: Soft always; Hardcore never before its Soll, which the
 * server answers with 409 `HARDCORE_BLOCK`.
 */
export function assertLiftable(block: BlockTiming, now: Date): void {
  if (block.mode === 'soft' || lapsedReason(block, now)) return;
  throw new ConflictException({
    message:
      'Eine Hardcore-Sperre endet erst mit dem Soll oder wenn die Quest erledigt ist.',
    code: 'HARDCORE_BLOCK',
  });
}

/**
 * During a Hardcore block the lists may only get stricter: adding to the
 * Sperrliste is fine, removing from it or allowing more waits until the
 * block is over (the block's own list mode is fixed at its start anyway).
 */
export function assertListChangeAllowed(
  hardcoreActive: boolean,
  change: { list: FocusList; action: 'add' | 'remove' },
): void {
  if (!hardcoreActive) return;
  const stricter = change.list === 'block' && change.action === 'add';
  if (stricter) return;
  throw new ConflictException({
    message:
      'Während einer Hardcore-Sperre lassen sich die Listen nur strenger machen.',
    code: 'HARDCORE_BLOCK',
  });
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * A website entry as typed ("https://www.YouTube.com/watch", "youtube.com")
 * reduced to its host ("youtube.com"): lower case, without scheme, path,
 * port, a leading "www." or "*." and a trailing dot. International names
 * become their ASCII form. It also covers every subdomain (`hostMatches`).
 */
export function normalizeDomain(input: string): string {
  let text = input.trim().toLowerCase();
  if (!text) throw new BadRequestException('Gib eine Website an.');
  if (text.startsWith('*.')) text = text.slice(2);
  let host: string;
  try {
    host = new URL(text.includes('://') ? text : `http://${text}`).hostname;
  } catch {
    throw new BadRequestException(`„${input.trim()}“ ist keine Website.`);
  }
  host = host.replace(/\.$/, '');
  if (host.startsWith('www.')) host = host.slice(4);
  const labels = host.split('.');
  if (
    host.length > 253 ||
    labels.length < 2 ||
    IPV4.test(host) ||
    !labels.every((label) => LABEL.test(label)) ||
    /^\d+$/.test(labels[labels.length - 1])
  )
    throw new BadRequestException(
      `„${input.trim()}“ ist keine Website. Gib sie so an: youtube.com`,
    );
  return host;
}

const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

/** An Android package name ("com.google.android.youtube"). */
export function normalizePackage(input: string): string {
  const value = input.trim();
  if (value.length > 255 || !PACKAGE.test(value))
    throw new BadRequestException(`„${value}“ ist kein App-Paketname.`);
  return value;
}

/** The host is the entry or one of its subdomains: "m.youtube.com" ⊂ "youtube.com". */
export function hostMatches(host: string, entry: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, '');
  return name === entry || name.endsWith(`.${entry}`);
}

export type HostPolicy = {
  listMode: FocusListMode;
  blocked: string[];
  allowed: string[];
  /** Hosts the app itself needs; never blocked. */
  fixedAllowed: string[];
};

/**
 * Whether a block stops this host. Sperrliste mode blocks what matches the
 * Sperrliste; strict mode blocks everything that matches neither the
 * Erlaubt-Liste nor the app's own hosts. The app's own hosts always pass.
 */
export function hostBlocked(host: string, policy: HostPolicy): boolean {
  const matches = (entries: string[]) =>
    entries.some((entry) => hostMatches(host, entry));
  if (matches(policy.fixedAllowed)) return false;
  if (policy.listMode === 'blocklist') return matches(policy.blocked);
  return !matches(policy.allowed);
}
