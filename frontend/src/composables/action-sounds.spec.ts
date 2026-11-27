import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMonthChallenges } from "../api/month-challenges.api";
import { getQuestHours } from "../api/quest-hours.api";
import { getWeekReview } from "../api/week-review.api";
import type { MonthChallenges } from "../types/month-challenge";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { WeekReviewResponse } from "../types/week-review";
import {
  MILESTONES_STORAGE_KEY,
  primeMilestones,
  primeMissingMilestones,
  resetActionSounds,
  startMilestonePriming,
  withActionSound,
  withWorkLogSound,
  type ActionSoundOptions,
} from "./action-sounds";
import { playEffect, updateSoundEffects } from "./useSoundEffects";

vi.mock("../api/quest-hours.api", () => ({ getQuestHours: vi.fn() }));
vi.mock("../api/week-review.api", () => ({ getWeekReview: vi.fn() }));
vi.mock("../api/month-challenges.api", () => ({ getMonthChallenges: vi.fn() }));
vi.mock("./useSoundEffects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./useSoundEffects")>()),
  playEffect: vi.fn(() => Promise.resolve()),
}));

const WEEK = "2026-11-23";

/** What the server would say; the actions change it. */
const server = {
  questMinutes: 0,
  target: 600 as number | null,
  perfect: false as boolean | null,
  done: 28,
  total: 30,
};

const DAILY: ActionSoundOptions<unknown> = {
  sound: "chime-done",
  kinds: ["perfect-week", "month-challenge", "quest-hours"],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
  localStorage.clear();
  updateSoundEffects({ enabled: true });
  resetActionSounds();
  Object.assign(server, {
    questMinutes: 0,
    target: 600,
    perfect: false,
    done: 28,
    total: 30,
  });
  vi.mocked(playEffect).mockClear();
  vi.mocked(getQuestHours)
    .mockReset()
    .mockImplementation(async () => ({
      startDate: WEEK,
      weeklyTargetMinutes: server.target,
      questMinutes: server.questMinutes,
    }) as QuestHoursResponse);
  vi.mocked(getWeekReview)
    .mockReset()
    .mockImplementation(async () => ({
      startDate: WEEK,
      perfectWeek:
        server.perfect === null
          ? null
          : { perfect: server.perfect, categories: [] },
    }) as unknown as WeekReviewResponse);
  vi.mocked(getMonthChallenges)
    .mockReset()
    .mockImplementation(async () => ({
      today: "2026-11-24",
      current: {
        month: "2026-11",
        status: "running",
        done: server.done,
        total: server.total,
      },
      next: null,
      past: [],
    }) as unknown as MonthChallenges);
});
afterEach(() => {
  vi.useRealTimers();
  updateSoundEffects({ enabled: false });
});

const sounds = () => vi.mocked(playEffect).mock.calls.map(([id]) => id);
const seen = () =>
  JSON.parse(localStorage.getItem(MILESTONES_STORAGE_KEY) ?? "[]");

/** What the app does on start and when the tab shows again. */
async function prime() {
  primeMissingMilestones();
  await flushPromises();
}

async function tick(
  change: () => void = () => {},
  options: ActionSoundOptions<unknown> = DAILY,
) {
  const result = await withActionSound(async () => {
    change();
    return "ok";
  }, options);
  await flushPromises();
  return result;
}

describe("withActionSound", () => {
  it("is the bare action with Töne off: no reads, no sound", async () => {
    updateSoundEffects({ enabled: false });
    const action = vi.fn(() => Promise.resolve(5));
    expect(await withActionSound(action, DAILY)).toBe(5);
    await flushPromises();
    expect(action).toHaveBeenCalledTimes(1);
    expect(getWeekReview).not.toHaveBeenCalled();
    expect(getMonthChallenges).not.toHaveBeenCalled();
    expect(playEffect).not.toHaveBeenCalled();
  });

  it("sounds Erledigt for a completion that reaches nothing", async () => {
    await prime();
    expect(await tick(() => server.done++)).toBe("ok");
    expect(sounds()).toEqual(["chime-done"]);
    // Read ahead once, and again after the action.
    expect(getWeekReview).toHaveBeenCalledTimes(2);
    expect(getMonthChallenges).toHaveBeenCalledTimes(2);
    expect(getQuestHours).toHaveBeenCalledTimes(2);
  });

  it("never waits for a reading: without one the action runs at once", async () => {
    let answer: () => void = () => {};
    vi.mocked(getWeekReview).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = () =>
            resolve({
              startDate: WEEK,
              perfectWeek: { perfect: true, categories: [] },
            } as unknown as WeekReviewResponse);
        }),
    );
    const action = vi.fn(() => Promise.resolve("ok"));
    const result = withActionSound(action, DAILY);
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(1);
    expect(await result).toBe("ok");
    answer();
    await flushPromises();
    // No "before" for this one: just its own sound; the next has a reading.
    expect(sounds()).toEqual(["chime-done"]);
  });

  it("sounds the milestone instead when a Daily completes the Perfect Week, once per week", async () => {
    await prime();
    await tick(() => (server.perfect = true));
    expect(sounds()).toEqual(["chime-milestone"]);
    expect(seen()).toContain(`perfect-week:${WEEK}`);

    // Opened again elsewhere and ticked again: no replay this week.
    server.perfect = false;
    vi.setSystemTime(new Date("2026-11-24T10:05:00Z"));
    await tick(() => (server.perfect = true));
    expect(sounds()).toEqual(["chime-milestone", "chime-done"]);

    // Next week it counts again.
    vi.setSystemTime(new Date("2026-12-01T10:00:00Z"));
    const NEXT = "2026-11-30";
    vi.mocked(getWeekReview).mockImplementation(async () => ({
      startDate: NEXT,
      perfectWeek: { perfect: server.perfect === true, categories: [] },
    }) as unknown as WeekReviewResponse);
    server.perfect = false;
    await prime();
    await tick(() => (server.perfect = true));
    expect(sounds().at(-1)).toBe("chime-milestone");
  });

  it("sounds the milestone when the Monats-Challenge reaches 100 %", async () => {
    server.done = 29;
    await prime();
    await tick(() => server.done++);
    expect(sounds()).toEqual(["chime-milestone"]);
    expect(seen()).toContain("month-challenge:2026-11");
  });

  it("does not celebrate what was reached before the action, and remembers it", async () => {
    server.perfect = true;
    server.done = 30;
    await prime();
    await tick();
    expect(sounds()).toEqual(["chime-done"]);
    expect(seen()).toEqual(
      expect.arrayContaining([`perfect-week:${WEEK}`, "month-challenge:2026-11"]),
    );
    // Nothing left to reach: the next tick reads nothing at all.
    vi.mocked(getWeekReview).mockClear();
    vi.mocked(getMonthChallenges).mockClear();
    vi.setSystemTime(new Date("2026-11-24T11:00:00Z"));
    await tick();
    expect(getWeekReview).not.toHaveBeenCalled();
    expect(getMonthChallenges).not.toHaveBeenCalled();
  });

  it("falls back to Erledigt when the reading before fails", async () => {
    vi.mocked(getWeekReview).mockRejectedValue(new TypeError("offline"));
    vi.mocked(getMonthChallenges).mockRejectedValue(new TypeError("offline"));
    await tick(() => (server.perfect = true));
    expect(sounds()).toEqual(["chime-done"]);
  });

  it("sounds nothing for an action that fails or did not go through", async () => {
    await expect(
      withActionSound(() => Promise.reject(new Error("nope")), DAILY),
    ).rejects.toThrow("nope");
    await withActionSound(() => Promise.resolve(false), {
      ...DAILY,
      ok: (done: boolean) => done,
    });
    await flushPromises();
    expect(playEffect).not.toHaveBeenCalled();
  });

  it("takes the quest hours read at the stopwatch's start for its pause", async () => {
    server.questMinutes = 580;
    primeMilestones(["quest-hours"], 60 * 60_000);
    await flushPromises();
    expect(getQuestHours).toHaveBeenCalledTimes(1);
    expect(getQuestHours).toHaveBeenCalledWith(WEEK);

    // Twenty minutes later the pause logs the stretch: goal reached.
    vi.setSystemTime(new Date("2026-11-24T10:20:00Z"));
    await tick(() => (server.questMinutes = 600), {
      sound: null,
      kinds: ["quest-hours"],
    });
    expect(getQuestHours).toHaveBeenCalledTimes(2);
    expect(sounds()).toEqual(["chime-milestone"]);
  });

  it("stays silent at a pause below the goal; a completion without a reading reads ahead for the next", async () => {
    server.questMinutes = 100;
    await withWorkLogSound(async () => (server.questMinutes = 200));
    await flushPromises();
    expect(playEffect).not.toHaveBeenCalled();

    // No reading before: no milestone now, only its own sound.
    resetActionSounds();
    vi.mocked(getQuestHours).mockClear();
    await tick(() => (server.questMinutes = 700));
    expect(getQuestHours).toHaveBeenCalledTimes(1);
    expect(sounds()).toEqual(["chime-done"]);
  });
});

describe("reading ahead", () => {
  const reads = () => [
    vi.mocked(getQuestHours).mock.calls.length,
    vi.mocked(getWeekReview).mock.calls.length,
    vi.mocked(getMonthChallenges).mock.calls.length,
  ];

  it("joins a read of the same kind on its way and keeps the longer time", async () => {
    // App start with a running stopwatch: every kind, then its quest hours.
    primeMissingMilestones();
    primeMilestones(["quest-hours"], 12 * 60 * 60_000);
    await flushPromises();
    expect(reads()).toEqual([1, 1, 1]);
    // Past the ten minutes the quest hours still serve the running stopwatch.
    vi.setSystemTime(new Date("2026-11-24T10:11:00Z"));
    await prime();
    expect(reads()).toEqual([1, 2, 2]);
  });

  it("never lets the read after an action join one started before it", async () => {
    server.questMinutes = 580;
    await prime();
    let release!: () => void;
    vi.mocked(getQuestHours).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              startDate: WEEK,
              weeklyTargetMinutes: 600,
              questMinutes: 580,
            } as QuestHoursResponse);
        }),
    );
    primeMilestones(["quest-hours"]);
    await flushPromises();
    await tick(() => (server.questMinutes = 600), {
      sound: null,
      kinds: ["quest-hours"],
    });
    expect(getQuestHours).toHaveBeenCalledTimes(3);
    expect(sounds()).toEqual(["chime-milestone"]);
    release();
    await flushPromises();
  });

  it("primes on start and whenever the page shows again, never while hidden", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    const stop = startMilestonePriming();
    await flushPromises();
    expect(reads()).toEqual([0, 0, 0]);
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(reads()).toEqual([1, 1, 1]);
    // Fresh readings: showing again reads nothing more.
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(reads()).toEqual([1, 1, 1]);
    stop();
    resetActionSounds();
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(reads()).toEqual([1, 1, 1]);
    Reflect.deleteProperty(document, "visibilityState");
  });
});
