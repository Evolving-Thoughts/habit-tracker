import { getMonthChallenges } from "../api/month-challenges.api";
import { getQuestHours } from "../api/quest-hours.api";
import { getWeekReview } from "../api/week-review.api";
import { getCurrentDateInTimeZone, weekStart } from "../utils/date";
import {
  currentPeriods,
  milestoneKey,
  monthChallengeReading,
  newlyReached,
  openKinds,
  perfectWeekReading,
  questHoursReading,
  reachedKeys,
  unmetKinds,
  type MilestoneKind,
  type MilestoneReading,
  type MilestoneSnapshot,
} from "../utils/milestones";
import {
  playEffect,
  soundEffectsEnabled,
  type SoundEffectId,
} from "./useSoundEffects";

/**
 * The short sound after an action of this tab (docs/focus-sounds.md,
 * "Töne"): its own sound ("Erledigt"), or the milestone sound when the
 * action reached a milestone for the first time. Only actions wrapped here
 * sound, so changes from other devices that arrive by polling stay silent.
 *
 * The milestones are read right before the action and again after it,
 * from endpoints the app has anyway (quest hours, weekly review, month
 * challenges); `utils/milestones.ts` compares the two. A milestone counts
 * once per period: its key is remembered on this device, also when it was
 * found reached already, so reloading or ticking again never replays it.
 */

export const MILESTONES_STORAGE_KEY = "sounds:milestones";

/**
 * A reading is trusted this long for the next action. Only actions change
 * the values, and each one reads them again afterwards; a change from
 * another device in between may at worst sound one milestone here too.
 */
const FRESH_MS = 10 * 60_000;
/** Every kind, for reading ahead when the app starts or the tab shows. */
export const ALL_MILESTONES: readonly MilestoneKind[] = [
  "quest-hours",
  "perfect-week",
  "month-challenge",
];
/**
 * While the own stopwatch runs, its quest hours change only when it stops:
 * the reading taken when it started serves its pause, stop or completion.
 */
export const RUNNING_STOPWATCH_MS = 12 * 60 * 60_000;
/** A read slower than this is left out, so it never holds up an action long. */
const READ_TIMEOUT_MS = 1_500;
/** Remembered keys; a few weeks' and months' worth. */
const SEEN_LIMIT = 24;

type Cached = { reading: MilestoneReading; at: number; ttl: number };
const cache = new Map<MilestoneKind, Cached>();

function loadSeen(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(MILESTONES_STORAGE_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function remember(keys: string[]): void {
  if (!keys.length) return;
  const seen = loadSeen();
  for (const key of keys) {
    // Moved to the end, so the oldest fall away first.
    seen.delete(key);
    seen.add(key);
  }
  try {
    localStorage.setItem(
      MILESTONES_STORAGE_KEY,
      JSON.stringify([...seen].slice(-SEEN_LIMIT)),
    );
  } catch {
    // Without storage a milestone may sound once more after a reload.
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout")),
      READ_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause: unknown) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

async function readKind(kind: MilestoneKind): Promise<MilestoneReading> {
  const monday = weekStart(getCurrentDateInTimeZone());
  switch (kind) {
    case "quest-hours":
      return questHoursReading(await getQuestHours(monday));
    case "perfect-week":
      return perfectWeekReading(await getWeekReview(monday));
    case "month-challenge":
      return monthChallengeReading(await getMonthChallenges());
  }
}

/** Reads the kinds side by side; a failed or slow read is left out (unknown). */
async function readSnapshot(
  kinds: readonly MilestoneKind[],
  ttl = FRESH_MS,
): Promise<MilestoneSnapshot> {
  const snapshot: MilestoneSnapshot = {};
  await Promise.all(
    kinds.map((kind) =>
      withTimeout(Promise.resolve().then(() => readKind(kind))).then(
        (reading) => {
          snapshot[kind] = reading;
          cache.set(kind, { reading, at: Date.now(), ttl });
        },
        () => cache.delete(kind),
      ),
    ),
  );
  return snapshot;
}

function cached(kind: MilestoneKind): MilestoneReading | undefined {
  const entry = cache.get(kind);
  if (!entry) return undefined;
  if (Date.now() - entry.at < entry.ttl) return entry.reading;
  cache.delete(kind);
  return undefined;
}

function periodsNow(): Record<MilestoneKind, string> {
  const today = getCurrentDateInTimeZone();
  return currentPeriods(today, weekStart(today));
}

/**
 * Reads milestones ahead in the background, so the next action need not
 * wait for them; e.g. the quest hours when the own stopwatch starts.
 */
export function primeMilestones(
  kinds: readonly MilestoneKind[],
  ttl = FRESH_MS,
): void {
  if (!soundEffectsEnabled()) return;
  const wanted = unmetKinds(kinds, periodsNow(), loadSeen());
  if (wanted.length) void readSnapshot(wanted, ttl);
}

/**
 * Reads ahead every milestone that has no fresh reading: on app start and
 * when the tab shows again, so actions find a "before" and never wait.
 */
export function primeMissingMilestones(): void {
  if (!soundEffectsEnabled()) return;
  const wanted = unmetKinds(ALL_MILESTONES, periodsNow(), loadSeen()).filter(
    (kind) => cached(kind) === undefined,
  );
  if (wanted.length) void readSnapshot(wanted);
}

/** Forgets every reading, e.g. between tests. */
export function resetActionSounds(): void {
  cache.clear();
}

export type ActionSoundOptions<T> = {
  /** The action's own sound; null for one that sounds only at a milestone. */
  sound: SoundEffectId | null;
  /** The milestones the action can reach. */
  kinds: readonly MilestoneKind[];
  /** Whether it went through; by default every action that resolves did. */
  ok?: (result: T) => boolean;
};

async function settle(
  before: MilestoneSnapshot,
  sound: SoundEffectId | null,
): Promise<void> {
  remember(reachedKeys(before));
  const open = openKinds(before, loadSeen());
  let reached: MilestoneKind[] = [];
  if (open.length) {
    const after = await readSnapshot(open);
    reached = newlyReached(before, after, loadSeen());
    remember(reached.map((kind) => milestoneKey(kind, after[kind]!.period)));
  }
  const id = reached.length ? "chime-milestone" : sound;
  if (id) await playEffect(id);
}

async function withSound<T>(
  action: () => Promise<T>,
  { sound, kinds, ok }: ActionSoundOptions<T>,
): Promise<T> {
  // Never waits: the "before" comes from readings taken ahead (app start,
  // tab shown again, the last action). A kind with none is read in the
  // background for the next action and gives only the action's own sound now.
  const before: MilestoneSnapshot = {};
  const missing: MilestoneKind[] = [];
  for (const kind of unmetKinds(kinds, periodsNow(), loadSeen())) {
    const known = cached(kind);
    if (known !== undefined) before[kind] = known;
    else missing.push(kind);
  }
  if (missing.length) void readSnapshot(missing);
  const result = await action();
  // The sound follows on its own; the caller goes on at once.
  if (!ok || ok(result)) void settle(before, sound).catch(() => {});
  return result;
}

/**
 * Runs an action of this tab and sounds its outcome. With "Töne" off it is
 * the bare action: no reads, no sound.
 */
export function withActionSound<T>(
  action: () => Promise<T>,
  options: ActionSoundOptions<T>,
): Promise<T> {
  if (!soundEffectsEnabled()) return action();
  return withSound(action, options);
}

/** Time logged or stretched by hand: it may reach the weekly quest-hours goal. */
export function withWorkLogSound<T>(action: () => Promise<T>): Promise<T> {
  return withActionSound(action, { sound: null, kinds: ["quest-hours"] });
}
