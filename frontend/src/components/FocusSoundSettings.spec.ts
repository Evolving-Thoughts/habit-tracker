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
  it("offers Aus, Musik and Geräusche in one compact select, chimes left out", async () => {
    const wrapper = await mountSettings();
    expect(wrapper.text()).toContain("Gilt auf diesem Gerät.");
    const select = wrapper.get<HTMLSelectElement>('select[name="focusSound"]');
    // Labelled for screen readers by its visible label.
    expect(
      wrapper.get(`label[for="${select.attributes("id")}"]`).text(),
    ).toBe("Klang");
    expect(select.get(":scope > option").text()).toBe("Aus");
    const groups = select.findAll("optgroup");
    expect(groups.map((group) => group.attributes("label"))).toEqual([
      "Musik",
      "Geräusche",
    ]);
    expect(
      groups.map((group) => group.findAll("option").map((option) => option.text())),
    ).toEqual([["Lo-Fi warm"], ["Regen", "Café"]]);
    expect(select.element.value).toBe("");
  });

  it("stores sound and volume on this device; the short sounds are elsewhere", async () => {
    const wrapper = await mountSettings();
    const select = wrapper.get('select[name="focusSound"]');
    await select.setValue("rain");
    expect(stored()).toMatchObject({ soundId: "rain" });
    await select.setValue("");
    expect(stored()).toMatchObject({ soundId: null });
    // The volume only turns with a sound chosen.
    await select.setValue("cafe");

    const volume = wrapper.get<HTMLInputElement>('input[type="range"]');
    expect(volume.element.value).toBe("60");
    expect(
      wrapper.get(`label[for="${volume.attributes("id")}"]`).text(),
    ).toBe("Lautstärke");
    await volume.setValue("35");
    expect(stored().volume).toBe(0.35);
    expect(volume.attributes("aria-valuetext")).toBe("35 %");

    // "Töne" replaced the chimes checkbox (SoundEffectSettings).
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Signaltöne");
    expect(stored()).not.toHaveProperty("chimes");
  });

  it("turns the volume off with the sound", async () => {
    const wrapper = await mountSettings();
    const volume = wrapper.get<HTMLInputElement>('input[type="range"]');
    expect(volume.element.disabled).toBe(true);
    await wrapper.get('select[name="focusSound"]').setValue("rain");
    expect(volume.element.disabled).toBe(false);
    await wrapper.get('select[name="focusSound"]').setValue("");
    expect(volume.element.disabled).toBe(true);
  });

  it("says so when the server has no sounds yet", async () => {
    vi.mocked(listSounds).mockResolvedValue([]);
    const wrapper = await mountSettings();
    expect(wrapper.text()).toContain("Noch keine Klänge verfügbar.");
    expect(wrapper.find("select").exists()).toBe(false);
  });

  it("says so calmly when the list cannot be read", async () => {
    vi.mocked(listSounds).mockRejectedValue(new TypeError("offline"));
    const wrapper = await mountSettings();
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Klänge konnten nicht geladen werden.",
    );
  });
});
