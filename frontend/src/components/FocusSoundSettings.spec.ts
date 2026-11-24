import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSounds } from "../api/sounds.api";
import type { Sound } from "../types/sound";
import { resetSoundCatalog } from "../composables/useFocusSound";
import {
  FOCUS_SOUND_STORAGE_KEY,
  reloadFocusSoundSettings,
} from "../composables/useFocusSoundSettings";
import FocusSoundSettings from "./FocusSoundSettings.vue";

vi.mock("../api/sounds.api", () => ({
  listSounds: vi.fn(),
  soundUrl: vi.fn(),
}));

enableAutoUnmount(afterEach);

const sound = (id: string, title: string, kind: Sound["kind"]): Sound => ({
  id,
  title,
  kind,
  version: "1",
});

beforeEach(() => {
  localStorage.clear();
  reloadFocusSoundSettings();
  resetSoundCatalog();
  vi.mocked(listSounds)
    .mockReset()
    .mockResolvedValue([
      sound("lofi-warm", "Lo-Fi warm", "music"),
      sound("rain", "Regen", "ambience"),
      sound("cafe", "Café", "ambience"),
      sound("chime-done", "Erledigt", "chime"),
    ]);
});

async function mountSettings() {
  const wrapper = mount(FocusSoundSettings, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}
const stored = () =>
  JSON.parse(localStorage.getItem(FOCUS_SOUND_STORAGE_KEY) ?? "null");

describe("FocusSoundSettings", () => {
  it("lists Aus, Musik and Geräusche as one radio choice, chimes left out", async () => {
    const wrapper = await mountSettings();
    expect(wrapper.text()).toContain("Gilt auf diesem Gerät.");
    expect(wrapper.findAll("legend").map((legend) => legend.text())).toEqual([
      "Klang",
      "Musik",
      "Geräusche",
    ]);
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');
    expect(
      radios.map((radio) => radio.element.parentElement!.textContent!.trim()),
    ).toEqual(["Aus", "Lo-Fi warm", "Regen", "Café"]);
    // One name: the arrow keys move through all of them.
    expect(new Set(radios.map((radio) => radio.attributes("name"))).size).toBe(
      1,
    );
    expect(radios[0]!.element.checked).toBe(true);
  });

  it("stores sound and volume on this device; the short sounds are elsewhere", async () => {
    const wrapper = await mountSettings();
    await wrapper.findAll('input[type="radio"]')[2]!.setValue(true);
    expect(stored()).toMatchObject({ soundId: "rain" });

    const volume = wrapper.get<HTMLInputElement>('input[type="range"]');
    expect(volume.element.value).toBe("60");
    expect(wrapper.get("label[for]").text()).toBe("Lautstärke");
    await volume.setValue("35");
    expect(stored().volume).toBe(0.35);
    expect(volume.attributes("aria-valuetext")).toBe("35 %");

    // "Töne" replaced the chimes checkbox (SoundEffectSettings).
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Signaltöne");
    expect(stored()).not.toHaveProperty("chimes");
  });

  it("says so when the server has no sounds yet", async () => {
    vi.mocked(listSounds).mockResolvedValue([]);
    const wrapper = await mountSettings();
    expect(wrapper.text()).toContain("Noch keine Klänge verfügbar.");
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
  });

  it("says so calmly when the list cannot be read", async () => {
    vi.mocked(listSounds).mockRejectedValue(new TypeError("offline"));
    const wrapper = await mountSettings();
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Klänge konnten nicht geladen werden.",
    );
  });
});
