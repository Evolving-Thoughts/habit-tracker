import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { listSounds } from "../api/sounds.api";
import {
  focusSoundNative,
  type FocusSoundNative,
} from "../native/focus-sound-plugin";
import type { Sound } from "../types/sound";
import {
  resetSoundCatalog,
  useFocusSound,
  type SoundOutput,
} from "./useFocusSound";
import {
  reloadFocusSoundSettings,
  updateFocusSound,
} from "./useFocusSoundSettings";
import { playEffect } from "./useSoundEffects";

vi.mock("../api/sounds.api", () => ({
  listSounds: vi.fn(),
  soundUrl: (sound: Sound) => `/api/sounds/${sound.id}?v=${sound.version}`,
}));
vi.mock("../native/focus-sound-plugin", () => ({
  focusSoundNative: vi.fn(() => null),
}));
// The short sounds have their own player and switch (useSoundEffects.spec.ts).
vi.mock("./useSoundEffects", () => ({
  playEffect: vi.fn(() => Promise.resolve()),
}));

const sound = (id: string, kind: Sound["kind"], title = id): Sound => ({
  id,
  title,
  kind,
  version: "1",
});
const CATALOG = [
  sound("lofi-warm", "music", "Lo-Fi warm"),
  sound("rain", "ambience", "Regen"),
  sound("chime-reached", "chime"),
  sound("chime-done", "chime"),
];

/** The composable with a stopwatch the test moves by hand. */
async function setup(
  initial: { id: string; state: "running" | "paused" } | null = null,
) {
  let clock = 0;
  const timer = ref<{ id: string; state: "running" | "paused" } | null>(
    initial,
  );
  const reached = ref(false);
  let stopped: (() => void) | null = null;
  let failed: (() => void) | null = null;
  const output = {
    play: vi.fn(),
    setVolume: vi.fn(),
    stop: vi.fn(),
    onStopped: vi.fn((handler: () => void) => {
      stopped = handler;
      return () => {};
    }),
  } satisfies SoundOutput;
  const scope = effectScope();
  const focus = scope.run(() =>
    useFocusSound({
      timerKey: () => `${timer.value?.id ?? ""}:${timer.value?.state ?? ""}`,
      running: () => timer.value?.state === "running",
      reached: () => reached.value,
      createOutput: (onError) => {
        failed = onError;
        return output;
      },
      now: () => clock,
    }),
  )!;
  await flushPromises();
  const set = async (next: typeof timer.value) => {
    timer.value = next;
    await nextTick();
  };
  const played = () => output.play.mock.calls.map(([entry]) => entry.id);
  return {
    focus,
    output,
    scope,
    set,
    played,
    reached,
    advance: (ms: number) => (clock += ms),
    notificationStop: () => stopped!(),
    loadError: () => failed!(),
  };
}

beforeEach(() => {
  localStorage.clear();
  reloadFocusSoundSettings();
  resetSoundCatalog();
  vi.mocked(listSounds).mockReset().mockResolvedValue(CATALOG);
  vi.mocked(playEffect).mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useFocusSound", () => {
  it("plays on when the Fokus-Modus is opened again while its stopwatch still runs", async () => {
    updateFocusSound({ soundId: "rain" });
    const first = await setup();
    first.focus.gesture();
    await first.set({ id: "t1", state: "running" });
    expect(first.played()).toEqual(["rain"]);
    // Off to Heute: the sound stops with the view.
    first.scope.stop();
    expect(first.output.stop).toHaveBeenCalled();

    // Back, the same stopwatch still running: no new tap needed.
    const back = await setup({ id: "t1", state: "running" });
    expect(back.played()).toEqual(["rain"]);
    back.scope.stop();

    // A different stopwatch running meanwhile stays silent.
    const other = await setup({ id: "t2", state: "running" });
    expect(other.played()).toEqual([]);
    other.scope.stop();
  });

  it("does not carry the sound over a pause made in the view", async () => {
    updateFocusSound({ soundId: "rain" });
    const first = await setup();
    first.focus.gesture();
    await first.set({ id: "t1", state: "running" });
    await first.set({ id: "t1", state: "paused" });
    first.scope.stop();
    // Resumed elsewhere, then back: it waits for a tap here again.
    const back = await setup({ id: "t1", state: "running" });
    expect(back.played()).toEqual([]);
    back.scope.stop();
  });

  it("follows Start and Pause pressed here at once, before the server answers", async () => {
    vi.useFakeTimers();
    try {
      updateFocusSound({ soundId: "rain" });
      const { focus, output, set, played } = await setup();
      focus.gesture("start");
      expect(played()).toEqual(["rain"]);
      expect(focus.state.value).toBe("playing");
      // The server confirms: nothing starts twice.
      await set({ id: "t1", state: "running" });
      expect(output.play).toHaveBeenCalledTimes(1);

      focus.gesture("pause");
      expect(output.stop).toHaveBeenCalledTimes(1);
      expect(focus.state.value).toBe("paused");
      await set({ id: "t1", state: "paused" });
      expect(output.play).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls silent again when the server never confirms a Start", async () => {
    vi.useFakeTimers();
    try {
      updateFocusSound({ soundId: "rain" });
      const { focus, output, advance } = await setup();
      focus.gesture("start");
      expect(focus.state.value).toBe("playing");
      advance(8_100);
      vi.advanceTimersByTime(8_100);
      expect(output.stop).toHaveBeenCalledTimes(1);
      expect(focus.state.value).toBe("paused");
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes when a Pause pressed here is not confirmed", async () => {
    vi.useFakeTimers();
    try {
      updateFocusSound({ soundId: "rain" });
      const { focus, output, set, advance } = await setup();
      focus.gesture("start");
      await set({ id: "t1", state: "running" });
      focus.gesture("pause");
      expect(output.stop).toHaveBeenCalledTimes(1);
      advance(8_100);
      vi.advanceTimersByTime(8_100);
      expect(output.play).toHaveBeenCalledTimes(2);
      expect(focus.state.value).toBe("playing");
    } finally {
      vi.useRealTimers();
    }
  });

  it("plays with a stopwatch started here and stops when it pauses", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, output, set, played } = await setup();
    expect(focus.state.value).toBe("paused");

    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(played()).toEqual(["rain"]);
    expect(output.play).toHaveBeenCalledWith(CATALOG[1], 0.6);
    expect(focus.state.value).toBe("playing");
    expect(focus.sound.value?.title).toBe("Regen");

    // The poll's fresh objects with the same key change nothing.
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledTimes(1);

    await set({ id: "t1", state: "paused" });
    expect(output.stop).toHaveBeenCalledTimes(1);
    expect(focus.state.value).toBe("paused");

    // Resumed elsewhere: this device stays silent.
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledTimes(1);

    // Resumed here: it plays again.
    await set({ id: "t1", state: "paused" });
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledTimes(2);
  });

  it("never starts by itself for a stopwatch already running or started elsewhere", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, output, set } = await setup();
    await set({ id: "t1", state: "running" });
    expect(output.play).not.toHaveBeenCalled();
    expect(focus.state.value).toBe("paused");

    await set(null);
    await set({ id: "t2", state: "running" });
    expect(output.play).not.toHaveBeenCalled();
  });

  it("plays a sound chosen while the stopwatch runs; a choice beforehand waits for Start", async () => {
    const { focus, set, played, output } = await setup();
    expect(focus.state.value).toBe("off");
    focus.choose("lofi-warm");
    expect(focus.state.value).toBe("paused");
    // Started on another device after the choice: still silent.
    await set({ id: "t1", state: "running" });
    expect(output.play).not.toHaveBeenCalled();

    focus.choose("rain");
    expect(played()).toEqual(["rain"]);
    focus.choose("lofi-warm");
    expect(played()).toEqual(["rain", "lofi-warm"]);
    focus.choose(null);
    expect(output.stop).toHaveBeenCalledTimes(1);
    expect(focus.state.value).toBe("off");
  });

  it("changes the volume live and keeps it", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, output, set } = await setup();
    focus.setVolume(0.3);
    expect(output.setVolume).not.toHaveBeenCalled();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledWith(CATALOG[1], 0.3);
    focus.setVolume(0.9);
    expect(output.setVolume).toHaveBeenCalledWith(0.9);
    expect(focus.volume.value).toBe(0.9);
  });

  describe("M", () => {
    it("brings back the last sound, else the first music, and switches it off", async () => {
      const { focus, set, played } = await setup();
      await set({ id: "t1", state: "running" });
      expect(focus.toggle()).toBe(true);
      expect(focus.soundId.value).toBe("lofi-warm");
      expect(played()).toEqual(["lofi-warm"]);

      focus.choose("rain");
      expect(focus.toggle()).toBe(true);
      expect(focus.state.value).toBe("off");
      expect(focus.toggle()).toBe(true);
      expect(focus.soundId.value).toBe("rain");
      expect(focus.state.value).toBe("playing");
    });

    it("starts a chosen sound that is silent while the stopwatch runs", async () => {
      updateFocusSound({ soundId: "rain" });
      const { focus, set, played } = await setup();
      await set({ id: "t1", state: "running" });
      expect(focus.state.value).toBe("paused");
      focus.toggle();
      expect(played()).toEqual(["rain"]);
    });

    it("switches a waiting sound off while the stopwatch is paused", async () => {
      updateFocusSound({ soundId: "rain" });
      const { focus } = await setup();
      focus.toggle();
      expect(focus.state.value).toBe("off");
    });

    it("does nothing without any sound on the server", async () => {
      vi.mocked(listSounds).mockResolvedValue([]);
      const { focus } = await setup();
      expect(focus.toggle()).toBe(false);
      expect(focus.note.value).toBe("Noch keine Klänge verfügbar.");
    });
  });

  describe("chimes", () => {
    it("chime once when the Soll is reached while it runs here", async () => {
      const { focus, set, reached } = await setup();
      focus.gesture();
      await set({ id: "t1", state: "running" });
      reached.value = true;
      await nextTick();
      expect(playEffect).toHaveBeenCalledTimes(1);
      expect(playEffect).toHaveBeenCalledWith("chime-reached");

      // A paused and resumed stopwatch, or a Soll raised and reached again: no second chime.
      reached.value = false;
      await set({ id: "t1", state: "paused" });
      focus.gesture();
      await set({ id: "t1", state: "running" });
      reached.value = true;
      await nextTick();
      expect(playEffect).toHaveBeenCalledTimes(1);

      // The next stopwatch chimes again.
      reached.value = false;
      focus.gesture();
      await set({ id: "t2", state: "running" });
      reached.value = true;
      await nextTick();
      expect(playEffect).toHaveBeenCalledTimes(2);
    });

    it("stays quiet for a stopwatch started elsewhere or already past its Soll", async () => {
      const { focus, set, reached } = await setup();
      await set({ id: "t1", state: "running" });
      reached.value = true;
      await nextTick();
      expect(playEffect).not.toHaveBeenCalled();

      reached.value = false;
      await set({ id: "t1", state: "paused" });
      focus.gesture();
      reached.value = true;
      await set({ id: "t1", state: "running" });
      expect(playEffect).not.toHaveBeenCalled();
    });

    it("leaves Erledigt to the shared completion path", async () => {
      const { focus } = await setup();
      expect("chimeDone" in focus).toBe(false);
      expect(playEffect).not.toHaveBeenCalled();
    });
  });

  it("says so calmly when a sound cannot load, and tries again on the next start", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, set, output, loadError } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    loadError();
    expect(focus.state.value).toBe("paused");
    expect(focus.note.value).toBe("Klang konnte nicht geladen werden.");

    focus.choose("rain");
    expect(output.play).toHaveBeenCalledTimes(2);
    expect(focus.note.value).toBeNull();
  });

  it("notes a chosen sound the server no longer has", async () => {
    updateFocusSound({ soundId: "fireplace" });
    const { focus, set, output } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(output.play).not.toHaveBeenCalled();
    expect(focus.note.value).toBe("Klang konnte nicht geladen werden.");
  });

  it("notes a catalog that cannot be read", async () => {
    vi.mocked(listSounds).mockRejectedValue(new TypeError("offline"));
    const { focus } = await setup();
    expect(focus.note.value).toBe("Klänge konnten nicht geladen werden.");
  });

  it("starts once the catalog arrives after the gesture", async () => {
    updateFocusSound({ soundId: "rain" });
    let answer: (sounds: Sound[]) => void = () => {};
    vi.mocked(listSounds).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    const { focus, set, played } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(played()).toEqual([]);
    answer(CATALOG);
    await flushPromises();
    expect(played()).toEqual(["rain"]);
  });

  it("follows a stop from the Android notification: off here, the choice kept", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, set, notificationStop, output } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    notificationStop();
    expect(focus.state.value).toBe("off");
    expect(focus.soundId.value).toBeNull();
    // Not stopped twice, and the next poll does not start it again.
    expect(output.stop).not.toHaveBeenCalled();
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledTimes(1);
    // Stored for the next time; M brings it back now.
    expect(JSON.parse(localStorage.getItem("focus:sound")!).soundId).toBe(
      "rain",
    );
    focus.toggle();
    expect(focus.state.value).toBe("playing");
    expect(output.play).toHaveBeenCalledTimes(2);
  });

  it("lets a Start pressed here count only for a while", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, set, output, advance } = await setup();
    // Start pressed, but nothing started (refused, or the question declined).
    focus.gesture();
    advance(60_000);
    // Started on another device much later: silent here.
    await set({ id: "t1", state: "running" });
    expect(output.play).not.toHaveBeenCalled();
  });

  it("stays silent for another stopwatch started elsewhere while one played", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, set, output } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(output.play).toHaveBeenCalledTimes(1);
    await set({ id: "t2", state: "running" });
    expect(output.stop).toHaveBeenCalledTimes(1);
    expect(focus.state.value).toBe("paused");
  });

  it("stops when the Fokus-Modus closes", async () => {
    updateFocusSound({ soundId: "rain" });
    const { focus, set, output, scope } = await setup();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    scope.stop();
    expect(output.stop).toHaveBeenCalledTimes(1);
  });
});

describe("useFocusSound on Android", () => {
  /** A fake FocusSound plugin whose play() calls the test settles by hand. */
  function fakePlugin() {
    const plays: {
      options: Parameters<FocusSoundNative["play"]>[0];
      resolve: () => void;
      reject: (cause: unknown) => void;
    }[] = [];
    let stopped: () => void = () => {};
    const plugin = {
      play: vi.fn(
        (options: Parameters<FocusSoundNative["play"]>[0]) =>
          new Promise<void>((resolve, reject) =>
            plays.push({ options, resolve, reject }),
          ),
      ),
      stop: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(() => Promise.resolve()),
      chime: vi.fn(() => Promise.resolve()),
      onStopped: vi.fn((handler: () => void) => {
        stopped = handler;
        return () => {};
      }),
    } satisfies FocusSoundNative;
    vi.mocked(focusSoundNative).mockReturnValue(plugin);
    return { plugin, plays, stop: () => stopped() };
  }

  async function mountNative() {
    const timer = ref<{ id: string; state: "running" | "paused" } | null>(null);
    const scope = effectScope();
    const focus = scope.run(() =>
      useFocusSound({
        timerKey: () => `${timer.value?.id ?? ""}:${timer.value?.state ?? ""}`,
        running: () => timer.value?.state === "running",
        reached: () => false,
      }),
    )!;
    await flushPromises();
    return {
      focus,
      scope,
      set: async (next: typeof timer.value) => {
        timer.value = next;
        await nextTick();
      },
    };
  }

  afterEach(() => vi.mocked(focusSoundNative).mockReturnValue(null));

  it("hands the plugin an absolute url and the title", async () => {
    const { plugin } = fakePlugin();
    updateFocusSound({ soundId: "rain", volume: 0.4 });
    const { focus, set } = await mountNative();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    expect(plugin.play).toHaveBeenCalledWith({
      id: "rain",
      url: new URL("/api/sounds/rain?v=1", window.location.href).href,
      title: "Regen",
      volume: 0.4,
    });
  });

  it("takes a replaced or stopped play() for no error, only the latest failure", async () => {
    const { plays } = fakePlugin();
    updateFocusSound({ soundId: "rain" });
    const { focus, set } = await mountNative();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    focus.choose("lofi-warm");
    // The plugin rejects the first play without a code when the second replaces it.
    plays[0]!.reject(new Error("Wiedergabe abgelöst"));
    await flushPromises();
    expect(focus.state.value).toBe("playing");
    expect(focus.note.value).toBeNull();

    await set({ id: "t1", state: "paused" });
    plays[1]!.reject(
      Object.assign(new Error("abgebrochen"), { code: "CANCELLED" }),
    );
    await flushPromises();
    expect(focus.loadFailed.value).toBe(false);

    focus.gesture();
    await set({ id: "t1", state: "running" });
    plays[2]!.reject(new Error("Klang konnte nicht geladen werden"));
    await flushPromises();
    expect(focus.loadFailed.value).toBe(true);
    expect(focus.state.value).toBe("paused");
  });

  it("goes off on the plugin's stopped event", async () => {
    const native = fakePlugin();
    updateFocusSound({ soundId: "rain" });
    const { focus, set } = await mountNative();
    focus.gesture();
    await set({ id: "t1", state: "running" });
    native.plays[0]!.resolve();
    native.stop();
    expect(focus.state.value).toBe("off");
    expect(native.plugin.stop).not.toHaveBeenCalled();
  });
});
