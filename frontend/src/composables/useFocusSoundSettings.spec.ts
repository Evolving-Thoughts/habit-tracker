import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOCUS_SOUND_STORAGE_KEY,
  parseFocusSound,
  reloadFocusSoundSettings,
  useFocusSoundSettings,
} from "./useFocusSoundSettings";

beforeEach(() => {
  localStorage.clear();
  reloadFocusSoundSettings();
});
afterEach(() => vi.restoreAllMocks());

const stored = () =>
  JSON.parse(localStorage.getItem(FOCUS_SOUND_STORAGE_KEY) ?? "null");

describe("focus sound settings", () => {
  it("starts with no sound and 60 %", () => {
    expect(useFocusSoundSettings().settings.value).toEqual({
      soundId: null,
      volume: 0.6,
      lastSoundId: null,
    });
  });

  it("stores a change on this device and shares it", () => {
    const first = useFocusSoundSettings();
    first.update({ soundId: "rain", volume: 0.3 });
    expect(useFocusSoundSettings().settings.value).toMatchObject({
      soundId: "rain",
      volume: 0.3,
      lastSoundId: "rain",
    });
    expect(stored()).toEqual({
      soundId: "rain",
      volume: 0.3,
      lastSoundId: "rain",
    });

    // "Aus" keeps the last sound for M.
    first.update({ soundId: null });
    expect(stored()).toMatchObject({ soundId: null, lastSoundId: "rain" });
  });

  it("reads back what was stored; the old chimes field is left to the Töne", () => {
    localStorage.setItem(
      FOCUS_SOUND_STORAGE_KEY,
      JSON.stringify({ soundId: "cafe", volume: 0.25, chimes: false }),
    );
    reloadFocusSoundSettings();
    expect(useFocusSoundSettings().settings.value).toEqual({
      soundId: "cafe",
      volume: 0.25,
      lastSoundId: "cafe",
    });
  });

  it("falls back field by field on anything broken", () => {
    expect(parseFocusSound("not json")).toEqual(parseFocusSound(null));
    expect(parseFocusSound("[1]").volume).toBe(0.6);
    expect(
      parseFocusSound(
        JSON.stringify({ soundId: 4, volume: "laut", chimes: "ja" }),
      ),
    ).toEqual({ soundId: null, volume: 0.6, lastSoundId: null });
    expect(parseFocusSound(JSON.stringify({ volume: 7 })).volume).toBe(1);
    expect(parseFocusSound(JSON.stringify({ volume: -1 })).volume).toBe(0);
    expect(parseFocusSound(JSON.stringify({ soundId: "" })).soundId).toBeNull();
  });

  it("keeps working without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    reloadFocusSoundSettings();
    const { settings, update } = useFocusSoundSettings();
    expect(settings.value.volume).toBe(0.6);
    update({ soundId: "rain" });
    expect(settings.value.soundId).toBe("rain");
  });
});
