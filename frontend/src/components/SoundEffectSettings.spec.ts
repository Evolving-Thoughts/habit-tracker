import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSounds } from "../api/sounds.api";
import type { Sound } from "../types/sound";
import { resetSoundCatalog } from "../composables/sound-catalog";
import {
  reloadSoundEffects,
  SOUND_EFFECTS_STORAGE_KEY,
  updateSoundEffects,
} from "../composables/useSoundEffects";
import SoundEffectSettings from "./SoundEffectSettings.vue";

vi.mock("../api/sounds.api", () => ({
  listSounds: vi.fn(),
  soundUrl: (sound: Sound) => `/api/sounds/${sound.id}?v=${sound.version}`,
}));

enableAutoUnmount(afterEach);

let play: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  reloadSoundEffects();
  resetSoundCatalog();
  vi.mocked(listSounds).mockResolvedValue([
    { id: "chime-done", title: "Erledigt", kind: "chime", version: "1" },
  ]);
  play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  updateSoundEffects({ enabled: false });
});

const stored = () =>
  JSON.parse(localStorage.getItem(SOUND_EFFECTS_STORAGE_KEY) ?? "null");

describe("SoundEffectSettings", () => {
  it("switches the short sounds on this device, said in words", async () => {
    const wrapper = mount(SoundEffectSettings);
    const toggle = wrapper.get('[role="switch"]');
    expect(toggle.attributes("aria-checked")).toBe("true");
    expect(wrapper.text()).toContain("Gilt auf diesem Gerät.");
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Töne sind eingeschaltet.",
    );

    await toggle.trigger("click");
    expect(toggle.attributes("aria-checked")).toBe("false");
    expect(stored()).toMatchObject({ enabled: false });
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Töne sind ausgeschaltet.",
    );
    expect(
      wrapper.get<HTMLInputElement>('input[type="range"]').element.disabled,
    ).toBe(true);
  });

  it("sets their volume and lets it be heard", async () => {
    const wrapper = mount(SoundEffectSettings);
    const volume = wrapper.get<HTMLInputElement>('input[type="range"]');
    expect(wrapper.get("label").text()).toBe("Lautstärke der Töne");
    expect(volume.element.value).toBe("60");
    await volume.setValue("30");
    expect(stored()).toEqual({ enabled: true, volume: 0.3 });
    expect(volume.attributes("aria-valuetext")).toBe("30 %");
    // Letting go of the slider (change) plays a sample.
    await flushPromises();
    expect(play).toHaveBeenCalledTimes(1);
  });
});
