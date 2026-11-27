import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { endFocusBlock, getFocusBlock } from "../api/focus-block.api";
import { ApiError } from "../api/http";
import type { FocusBlockNative } from "../native/focus-block-plugin";
import type { FocusBlockState } from "../types/focus-block";
import { createFocusBlockController } from "./useFocusBlock";

vi.mock("../api/focus-block.api", () => ({
  getFocusBlock: vi.fn(),
  saveFocusSettings: vi.fn(),
  addFocusEntry: vi.fn(),
  removeFocusEntry: vi.fn(),
  startFocusBlock: vi.fn(),
  endFocusBlock: vi.fn(),
}));

const SERVER_NOW = "2026-11-23T10:00:00.000Z";
const state = (block: FocusBlockState["block"] = null): FocusBlockState => ({
  version: "v1",
  serverNow: SERVER_NOW,
  settings: {
    enabled: true,
    trigger: "stopwatch",
    thresholdMinutes: 15,
    mode: "hardcore",
    listMode: "blocklist",
  },
  block,
  lists: { block: [], allow: [] },
  fixedDomains: [],
});
const hardcore = {
  id: "b",
  title: "Kapitel",
  todoId: 1,
  occurrenceId: null,
  mode: "hardcore" as const,
  listMode: "blocklist" as const,
  startedAt: SERVER_NOW,
  endsAt: "2026-11-23T10:12:00.000Z",
};

function fakeNative() {
  return {
    getStatus: vi.fn(),
    openAccessibilitySettings: vi.fn(),
    requestVpnPermission: vi.fn(),
    listInstalledApps: vi.fn(),
    setBlock: vi.fn().mockResolvedValue(undefined),
    onOpenFocus: vi.fn(() => () => {}),
  } satisfies FocusBlockNative;
}

describe("createFocusBlockController", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  it("hands every answer to the phone and forgets it on sign-out", async () => {
    const native = fakeNative();
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    const focus = createFocusBlockController(native);
    await focus.refresh();
    expect(native.setBlock).toHaveBeenCalledWith(state(hardcore));
    focus.dispose();
    expect(native.setBlock).toHaveBeenLastCalledWith(null);
  });

  it("reads the phone's permissions with every refresh and names what is missing", async () => {
    const native = fakeNative();
    native.getStatus.mockResolvedValue({
      accessibilityEnabled: false,
      vpnPrepared: true,
    });
    vi.mocked(getFocusBlock).mockResolvedValue({
      ...state(),
      lists: {
        block: [{ id: 1, kind: "app", value: "com.example", label: null }],
        allow: [],
      },
    });
    const focus = createFocusBlockController(native);
    await focus.refresh();
    expect(focus.setupIssues.value).toEqual(["accessibility"]);
    native.getStatus.mockResolvedValue({
      accessibilityEnabled: true,
      vpnPrepared: true,
    });
    await focus.refresh();
    expect(focus.setupIssues.value).toEqual([]);
  });

  it("counts a Hardcore block down on the server's clock", async () => {
    // The device runs two minutes ahead of the server.
    vi.setSystemTime(Date.parse(SERVER_NOW) + 2 * 60_000);
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    const focus = createFocusBlockController(null);
    await focus.refresh();
    expect(focus.minutesLeft.value).toBe(12);
    vi.setSystemTime(Date.parse(SERVER_NOW) + 7 * 60_000);
    focus.tick();
    expect(focus.minutesLeft.value).toBe(7);
  });

  it("keeps the block and says why when lifting Hardcore is refused", async () => {
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    vi.mocked(endFocusBlock).mockRejectedValue(
      new ApiError(
        "Eine Hardcore-Sperre endet erst mit dem Soll oder wenn die Quest erledigt ist.",
        409,
        "HARDCORE_BLOCK",
      ),
    );
    const focus = createFocusBlockController(null);
    await focus.refresh();
    expect(await focus.end()).toBe(false);
    expect(focus.block.value?.id).toBe("b");
    expect(focus.error.value).toContain("Hardcore-Sperre");
  });
});

describe("when the Fokus-Sperre is read", () => {
  let visibility: DocumentVisibilityState = "visible";
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(getFocusBlock).mockResolvedValue(state());
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  /** Answers held back until the test lets them go, one at a time. */
  function heldAnswers() {
    const waiting: (() => void)[] = [];
    vi.mocked(getFocusBlock).mockImplementation(
      () => new Promise((resolve) => waiting.push(() => resolve(state()))),
    );
    return () => waiting.shift()?.();
  }

  it("sends no second read while one is on its way", async () => {
    const release = heldAnswers();
    const focus = createFocusBlockController(null);
    const first = focus.refresh();
    const second = focus.refresh();
    expect(getFocusBlock).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(getFocusBlock).toHaveBeenCalledTimes(1);
    expect(focus.state.value).toEqual(state());
  });

  it("reads once more after a read that a change overtook", async () => {
    const release = heldAnswers();
    const focus = createFocusBlockController(null);
    const first = focus.refresh();
    // The stopwatch changed meanwhile: the answer on its way may predate it.
    const changed = focus.refresh(true);
    void focus.refresh(true);
    release();
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(2);
    release();
    await Promise.all([first, changed]);
    expect(getFocusBlock).toHaveBeenCalledTimes(2);
  });

  it("reads once now and once per trigger, until stopped", async () => {
    const stopwatch = ref<string | null>("");
    const focus = createFocusBlockController(null);
    const stop = focus.startSync(stopwatch);
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_000);
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(3);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event("timer-target-changed"));
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(5);
    stopwatch.value = "a:running";
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(6);
    stop();
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("timer-target-changed"));
    stopwatch.value = "a:paused";
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(6);
    focus.dispose();
  });

  it("follows the stopwatch's changes, not its first answer", async () => {
    const release = heldAnswers();
    const stopwatch = ref<string | null>(null);
    const focus = createFocusBlockController(null);
    const stop = focus.startSync(stopwatch);
    // App start: the stopwatch answers while the block is still on its way.
    stopwatch.value = "a:running";
    await flushPromises();
    release();
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(1);
    // A pause confirmed during a read: one more read after it.
    window.dispatchEvent(new Event("focus"));
    stopwatch.value = "a:paused";
    await flushPromises();
    release();
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(3);
    release();
    await flushPromises();
    stop();
    focus.dispose();
  });

  it("rests while the page is hidden, apart from the stopwatch", async () => {
    const stopwatch = ref<string | null>("");
    const focus = createFocusBlockController(null);
    const stop = focus.startSync(stopwatch);
    await flushPromises();
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("timer-target-changed"));
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(1);
    // Paused on another device while away, as the stopwatch's poll found.
    stopwatch.value = "a:paused";
    await flushPromises();
    expect(getFocusBlock).toHaveBeenCalledTimes(2);
    stop();
    focus.dispose();
  });
});
