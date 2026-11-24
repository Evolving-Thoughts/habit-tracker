import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSounds } from "../api/sounds.api";
import {
  focusSoundNative,
  type FocusSoundNative,
} from "../native/focus-sound-plugin";
import type { Sound } from "../types/sound";
import { resetSoundCatalog } from "./sound-catalog";
import { FOCUS_SOUND_STORAGE_KEY } from "./useFocusSoundSettings";
import {
  migrateSoundEffects,
  parseSoundEffects,
  playEffect,
  reloadSoundEffects,
  SOUND_EFFECTS_STORAGE_KEY,
  updateSoundEffects,
  useSoundEffects,
} from "./useSoundEffects";

vi.mock("../api/sounds.api", () => ({
  listSounds: vi.fn(),
  soundUrl: (sound: Sound) => `/api/sounds/${sound.id}?v=${sound.version}`,
}));
vi.mock("../native/focus-sound-plugin", () => ({
  focusSoundNative: vi.fn(() => null),
}));

const chime = (id: string): Sound => ({
  id,
  title: id,
  kind: "chime",
  version: "3",
});
const CATALOG: Sound[] = [
  { id: "rain", title: "Regen", kind: "ambience", version: "1" },
  chime("chime-done"),
  chime("chime-milestone"),
];

const stored = () =>
  JSON.parse(localStorage.getItem(SOUND_EFFECTS_STORAGE_KEY) ?? "null");

let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  reloadSoundEffects();
  resetSoundCatalog();
  vi.mocked(listSounds).mockReset().mockResolvedValue(CATALOG);
  vi.mocked(focusSoundNative).mockReturnValue(null);
  play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  // The other specs start with "Töne" off (test/setup.ts).
  updateSoundEffects({ enabled: false });
});

const played = () =>
  play.mock.contexts.map((audio: unknown) => {
    const element = audio as HTMLAudioElement;
    return { src: new URL(element.src).pathname, volume: element.volume };
  });

describe("sound effect settings", () => {
  it("start on, at 60 %, and store a change on this device", () => {
    expect(useSoundEffects().settings.value).toEqual({
      enabled: true,
      volume: 0.6,
    });
    updateSoundEffects({ volume: 0.25 });
    updateSoundEffects({ enabled: false });
    expect(stored()).toEqual({ enabled: false, volume: 0.25 });
    reloadSoundEffects();
    expect(useSoundEffects().settings.value).toEqual({
      enabled: false,
      volume: 0.25,
    });
  });

  it("fall back field by field on anything broken", () => {
    expect(parseSoundEffects("kaputt")).toEqual({ enabled: true, volume: 0.6 });
    expect(
      parseSoundEffects(JSON.stringify({ enabled: "ja", volume: 7 })),
    ).toEqual({ enabled: true, volume: 1 });
    expect(parseSoundEffects(JSON.stringify({ volume: -1 })).volume).toBe(0);
  });

  it("start off where the Fokus-Klänge had their chimes switched off", () => {
    expect(migrateSoundEffects(null).enabled).toBe(true);
    expect(migrateSoundEffects("kaputt").enabled).toBe(true);
    expect(migrateSoundEffects(JSON.stringify({ chimes: true })).enabled).toBe(
      true,
    );
    expect(
      migrateSoundEffects(JSON.stringify({ soundId: "rain", chimes: false })),
    ).toEqual({ enabled: false, volume: 0.6 });

    localStorage.setItem(
      FOCUS_SOUND_STORAGE_KEY,
      JSON.stringify({ soundId: "rain", volume: 0.3, chimes: false }),
    );
    reloadSoundEffects();
    expect(useSoundEffects().settings.value.enabled).toBe(false);
    // Kept at once, before the Fokus-Klänge drop the old field.
    expect(stored()).toEqual({ enabled: false, volume: 0.6 });
    localStorage.setItem(
      FOCUS_SOUND_STORAGE_KEY,
      JSON.stringify({ soundId: "rain", volume: 0.3 }),
    );
    reloadSoundEffects();
    expect(useSoundEffects().settings.value.enabled).toBe(false);
  });

  it("keep working without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    reloadSoundEffects();
    expect(useSoundEffects().settings.value.enabled).toBe(true);
    updateSoundEffects({ enabled: false });
    expect(useSoundEffects().settings.value.enabled).toBe(false);
  });
});

describe("playEffect", () => {
  it("plays a short <audio> from the catalog in a browser, at the Töne volume", async () => {
    updateSoundEffects({ volume: 0.4 });
    await playEffect("chime-done");
    await playEffect("chime-milestone");
    expect(played()).toEqual([
      { src: "/api/sounds/chime-done", volume: 0.4 },
      { src: "/api/sounds/chime-milestone", volume: 0.4 },
    ]);
    // The catalog is read once and shared.
    expect(listSounds).toHaveBeenCalledTimes(1);
  });

  it("stays silent with Töne off", async () => {
    updateSoundEffects({ enabled: false });
    await playEffect("chime-done");
    expect(play).not.toHaveBeenCalled();
    expect(listSounds).not.toHaveBeenCalled();
  });

  it("skips a sound the server does not have, or a catalog that fails", async () => {
    await playEffect("chime-reached");
    expect(play).not.toHaveBeenCalled();

    resetSoundCatalog();
    vi.mocked(listSounds).mockRejectedValue(new TypeError("offline"));
    await expect(playEffect("chime-done")).resolves.toBeUndefined();
    expect(play).not.toHaveBeenCalled();
  });

  it("takes a refused play() calmly", async () => {
    play.mockRejectedValue(new Error("NotAllowedError"));
    await expect(playEffect("chime-done")).resolves.toBeUndefined();
  });

  it("goes through FocusSound.chime in the app, never through <audio>", async () => {
    const chimeCall = vi.fn(() => Promise.resolve());
    vi.mocked(focusSoundNative).mockReturnValue({
      chime: chimeCall,
    } as unknown as FocusSoundNative);
    const audio = vi.spyOn(window, "Audio");
    updateSoundEffects({ volume: 0.8 });
    await playEffect("chime-milestone");
    expect(chimeCall).toHaveBeenCalledWith({
      id: "chime-milestone",
      url: new URL("/api/sounds/chime-milestone?v=3", window.location.href)
        .href,
      volume: 0.8,
    });
    expect(audio).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();

    chimeCall.mockRejectedValueOnce(new Error("no file"));
    await expect(playEffect("chime-done")).resolves.toBeUndefined();
  });
});
